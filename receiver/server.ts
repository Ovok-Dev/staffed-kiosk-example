import type { Hl7Message } from "@medplum/core";
import { type Hl7MessageEvent, Hl7Server } from "@medplum/hl7";
import { createClient } from "@supabase/supabase-js";

import { MalformedMessageError, type ReceivedReading, readingsFromOru } from "./oru.ts";

type AckCode = "AA" | "AE" | "AR";

const DEFAULT_PORT = 2575;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} for the HL7 receiver`);
  return value;
}

const db = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const log = (level: "info" | "warn" | "error", message: string, context: Record<string, unknown>) =>
  console[level](JSON.stringify({ level, message, service: "hl7-receiver", ...context }));

/** Files one message: AA when stored, AR when it can never be filed, AE when a retry may work. */
async function file(message: Hl7Message): Promise<AckCode> {
  let readings: ReceivedReading[];
  try {
    readings = readingsFromOru(message);
  } catch (error) {
    if (!(error instanceof MalformedMessageError)) throw error;
    log("warn", "hl7 message refused", { reason: error.message });
    return "AR";
  }
  const [first] = readings;
  if (!first) return "AA";

  const known = UUID.test(first.pseudonym)
    ? (await db.from("patients").select("id").eq("id", first.pseudonym).maybeSingle()).data
    : null;
  if (!known) {
    log("warn", "hl7 message for an unknown patient", { controlId: first.controlId });
    return "AR";
  }

  const { error } = await db.from("readings").upsert(
    readings.map((reading) => ({
      control_id: reading.controlId,
      set_id: reading.setId,
      patient_id: reading.pseudonym,
      code: reading.code,
      code_system: reading.codeSystem,
      display: reading.display,
      value: reading.value,
      unit: reading.unit,
      observed_at: reading.observedAt,
    })),
    { onConflict: "control_id,set_id", ignoreDuplicates: true },
  );
  if (error) {
    log("error", "hl7 readings not stored", { controlId: first.controlId, code: error.code, error: error.message });
    return "AE";
  }

  log("info", "hl7 readings stored", { controlId: first.controlId, patientId: first.pseudonym, values: readings.length });
  return "AA";
}

const port = Number(process.env.HL7_PORT ?? DEFAULT_PORT);
const server = new Hl7Server((connection) => {
  connection.addEventListener("message", ({ message }: Hl7MessageEvent) => {
    file(message)
      .catch((error: unknown) => {
        log("error", "hl7 message failed", { error: error instanceof Error ? error.message : String(error) });
        return "AE" as const;
      })
      .then((ackCode) => connection.send(message.buildAck({ ackCode })));
  });
});

await server.start(port);
log("info", "hl7 receiver listening", { port });
