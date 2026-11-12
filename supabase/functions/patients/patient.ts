/** A row of the patient register. `id` is the pseudonym Ovok knows the patient by. */
export type PatientRecord = {
  id: string;
  cardCode: string;
  givenName: string;
  familyName: string;
  birthDate: string;
  ovokPatientId: string | null;
};

export type NewPatient = Pick<PatientRecord, "cardCode" | "givenName" | "familyName" | "birthDate">;

/** A register row whose Ovok Patient exists. */
export type LinkedPatient = PatientRecord & { ovokPatientId: string };

export class DuplicateCardError extends Error {
  constructor() {
    super("A patient already has this card");
  }
}

/** The register in the customer's database. */
export interface PatientStore {
  findByCard(cardCode: string): Promise<PatientRecord | null>;
  findById(id: string): Promise<PatientRecord | null>;
  /** Throws `DuplicateCardError` when the card code is taken. */
  insert(patient: NewPatient): Promise<PatientRecord>;
  linkOvokPatient(id: string, ovokPatientId: string): Promise<void>;
}

/** Who an Ovok access token belongs to. */
export type OvokCaller = {
  projectId: string;
  profile: string;
};

/** Ovok answered with an error, or could not be reached (`status` null). */
export class OvokUnavailableError extends Error {
  constructor(readonly status: number | null) {
    super(status === null ? "Ovok could not be reached" : `Ovok answered ${status}`);
  }
}

export class OvokTimeoutError extends Error {
  constructor() {
    super("Ovok did not answer in time");
  }
}

/** The Ovok calls the function makes, each with the nurse's own token. */
export interface OvokGateway {
  /** Null when Ovok refuses the token. */
  caller(token: string): Promise<OvokCaller | null>;
  /** The id of the Ovok Patient that carries this pseudonym, created when missing. */
  ensurePatient(token: string, pseudonym: string): Promise<string>;
}
