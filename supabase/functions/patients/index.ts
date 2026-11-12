import { createClient } from "npm:@supabase/supabase-js@2.118.0";

import { patientsHandler } from "./handler.ts";
import { ovokGateway } from "./ovok-gateway.ts";
import { DuplicateCardError, type PatientRecord, type PatientStore } from "./patient.ts";

const COLUMNS = "id, card_code, given_name, family_name, birth_date, ovok_patient_id";
const UNIQUE_VIOLATION = "23505";

type Row = {
  id: string;
  card_code: string;
  given_name: string;
  family_name: string;
  birth_date: string;
  ovok_patient_id: string | null;
};

class StoreError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

/** supabase-js returns plain objects; Postgres messages name the constraint, never the row's values. */
const storeError = (error: { code: string; message: string }) => new StoreError(error.code, error.message);

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Set ${name} for the patients function`);
  return value;
}

const db = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const toRecord = (row: Row): PatientRecord => ({
  id: row.id,
  cardCode: row.card_code,
  givenName: row.given_name,
  familyName: row.family_name,
  birthDate: row.birth_date,
  ovokPatientId: row.ovok_patient_id,
});

const store: PatientStore = {
  async findByCard(cardCode) {
    const { data, error } = await db.from("patients").select(COLUMNS).eq("card_code", cardCode).maybeSingle<Row>();
    if (error) throw storeError(error);
    return data ? toRecord(data) : null;
  },
  async findById(id) {
    const { data, error } = await db.from("patients").select(COLUMNS).eq("id", id).maybeSingle<Row>();
    if (error) throw storeError(error);
    return data ? toRecord(data) : null;
  },
  async insert(patient) {
    const { data, error } = await db
      .from("patients")
      .insert({
        card_code: patient.cardCode,
        given_name: patient.givenName,
        family_name: patient.familyName,
        birth_date: patient.birthDate,
      })
      .select(COLUMNS)
      .single<Row>();
    if (error?.code === UNIQUE_VIOLATION) throw new DuplicateCardError();
    if (error) throw storeError(error);
    return toRecord(data);
  },
  async linkOvokPatient(id, ovokPatientId) {
    const { error } = await db.from("patients").update({ ovok_patient_id: ovokPatientId }).eq("id", id);
    if (error) throw storeError(error);
  },
};

const handler = patientsHandler({
  store,
  ovok: ovokGateway(required("OVOK_BASE_URL"), required("PATIENT_IDENTIFIER_SYSTEM")),
  settings: {
    ovokProjectId: required("OVOK_PROJECT_ID"),
    publicPath: "/functions/v1/patients",
  },
  log: (level, message, context) =>
    console[level](JSON.stringify({ level, message, service: "patients-function", ...context })),
});

Deno.serve(handler);
