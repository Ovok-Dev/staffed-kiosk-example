import type { Hl7Message, Hl7Segment } from "@medplum/core";

/** One numeric value from an ORU^R01, as the CIS stores it. */
export type ReceivedReading = {
  controlId: string;
  setId: number;
  pseudonym: string;
  code: string;
  codeSystem: string | null;
  display: string | null;
  value: number;
  unit: string | null;
  observedAt: string;
};

export class MalformedMessageError extends Error {}

const NUMERIC = "NM";
const HL7_TIME = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?([+-]\d{4})?$/;

/** The readings in an IHE PCD-01 ORU^R01 that Ovok sends. Throws when the message cannot be filed. */
export function readingsFromOru(message: Hl7Message): ReceivedReading[] {
  const controlId = message.getSegment("MSH")?.getField(10).toString();
  const pseudonym = message.getSegment("PID")?.getField(3).getComponent(1);
  if (!controlId || !pseudonym) throw new MalformedMessageError("The message has no control id or patient id");

  return message
    .getAllSegments("OBX")
    .filter((obx) => obx.getField(2).toString() === NUMERIC)
    .map((obx) => toReading(obx, controlId, pseudonym));
}

function toReading(obx: Hl7Segment, controlId: string, pseudonym: string): ReceivedReading {
  const code = obx.getField(3);
  const value = Number(obx.getField(5).toString());
  if (!code.getComponent(1) || !Number.isFinite(value)) {
    throw new MalformedMessageError("An OBX has no code or no numeric value");
  }

  return {
    controlId,
    setId: Number(obx.getField(1).toString()),
    pseudonym,
    code: code.getComponent(1),
    codeSystem: code.getComponent(3) || null,
    display: code.getComponent(2) || null,
    value,
    unit: obx.getField(6).getComponent(1) || null,
    observedAt: isoTime(obx.getField(14).toString()),
  };
}

/** `20261111191530+0000` as `2026-11-11T19:15:30+00:00`. */
function isoTime(hl7: string): string {
  const parts = HL7_TIME.exec(hl7);
  if (!parts) throw new MalformedMessageError("An OBX has no observation time");
  const [, year, month, day, hour, minute, second = "00", offset = "+0000"] = parts;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${offset.slice(0, 3)}:${offset.slice(3)}`;
}
