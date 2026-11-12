import { config } from "./config";
import { accessToken } from "./ovok";

/** A patient from the register in Supabase. Only `ovokPatientId` ever reaches Ovok. */
export type Patient = {
  id: string;
  cardCode: string;
  givenName: string;
  familyName: string;
  birthDate: string;
  ovokPatientId: string;
};

export type NewPatient = Pick<Patient, "cardCode" | "givenName" | "familyName" | "birthDate">;

export class RegisterError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const NOT_FOUND = 404;

async function call(path: string, body: unknown): Promise<Response> {
  return fetch(`${config.supabaseUrl}/functions/v1/patients${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${await accessToken()}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function patientFrom(response: Response): Promise<Patient> {
  const body = (await response.json().catch(() => null)) as
    | { patient?: Patient; error?: { message?: string } }
    | null;
  if (response.ok && body?.patient) return body.patient;
  throw new RegisterError(response.status, body?.error?.message ?? "The patient register did not answer.");
}

/** The patient a card belongs to, or null when the card is not registered. */
export async function findPatient(cardCode: string): Promise<Patient | null> {
  const response = await call("/_search", { cardCode });
  if (response.status === NOT_FOUND) return null;
  return patientFrom(response);
}

export async function registerPatient(patient: NewPatient): Promise<Patient> {
  return patientFrom(await call("", patient));
}
