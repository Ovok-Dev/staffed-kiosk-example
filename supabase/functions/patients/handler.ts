import {
  DuplicateCardError,
  type LinkedPatient,
  type NewPatient,
  type OvokCaller,
  type OvokGateway,
  OvokTimeoutError,
  OvokUnavailableError,
  type PatientRecord,
  type PatientStore,
} from "./patient.ts";

export type HandlerSettings = {
  /** The Ovok project whose practitioners may use the register. */
  ovokProjectId: string;
  /** Where the function is served, for `Location` headers. */
  publicPath: string;
};

type Log = (level: "info" | "warn" | "error", message: string, context: Record<string, unknown>) => void;

type Deps = { store: PatientStore; ovok: OvokGateway; settings: HandlerSettings; log: Log };

type Auth = { token: string; caller: OvokCaller };

type Route = {
  method: string;
  pattern: RegExp;
  serve: (request: Request, auth: Auth, match: RegExpMatchArray | string[]) => Promise<Response>;
};

const ALLOWED_METHODS = "GET, POST, OPTIONS";
const CARD_CODE = /^[A-Za-z0-9-]{4,64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NAME_MAX_LENGTH = 100;
const EARLIEST_BIRTH_DATE = "1900-01-01";
const PRACTITIONER_PREFIX = "Practitioner/";

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
  }
}

/** Serves the patient register to practitioners of one Ovok project. */
export function patientsHandler({ store, ovok, settings, log }: Deps): (request: Request) => Promise<Response> {
  // Any origin may call: the bearer token, never a cookie, is what grants access.
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": ALLOWED_METHODS,
    "access-control-expose-headers": "location",
  };

  const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, ...headers, "content-type": "application/json" },
    });

  async function authorize(request: Request): Promise<Auth> {
    const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
    if (!token) {
      throw new HttpError(401, "token_missing", "Sign in to Ovok first.", { "www-authenticate": "Bearer" });
    }

    const caller = await ovok.caller(token);
    if (!caller) {
      log("warn", "ovok token refused", {});
      throw new HttpError(401, "token_invalid", "Your Ovok session has ended. Sign in again.", {
        "www-authenticate": 'Bearer error="invalid_token"',
      });
    }
    if (caller.projectId !== settings.ovokProjectId || !caller.profile.startsWith(PRACTITIONER_PREFIX)) {
      log("warn", "register access refused", { profile: caller.profile, projectId: caller.projectId });
      throw new HttpError(403, "not_allowed", "Only practitioners of this project can use the register.");
    }
    return { token, caller };
  }

  /** Every answer goes through here, so a register row never leaves without its Ovok Patient. */
  async function linked(patient: PatientRecord, token: string): Promise<LinkedPatient> {
    if (patient.ovokPatientId) return { ...patient, ovokPatientId: patient.ovokPatientId };

    const ovokPatientId = await ovok.ensurePatient(token, patient.id);
    await store.linkOvokPatient(patient.id, ovokPatientId);
    return { ...patient, ovokPatientId };
  }

  async function search(request: Request, token: string): Promise<Response> {
    const body = await readJson(request);
    const cardCode = typeof body.cardCode === "string" ? body.cardCode.trim() : "";
    if (!CARD_CODE.test(cardCode)) {
      throw new HttpError(422, "card_code_invalid", "A card code is 4 to 64 letters, digits or dashes.");
    }

    const patient = await store.findByCard(cardCode);
    if (!patient) throw new HttpError(404, "patient_not_found", "No patient has this card.");
    return json(200, { patient: await linked(patient, token) });
  }

  async function register(request: Request, token: string, caller: OvokCaller): Promise<Response> {
    const newPatient = validNewPatient(await readJson(request));

    let patient: PatientRecord;
    try {
      patient = await store.insert(newPatient);
    } catch (error) {
      if (error instanceof DuplicateCardError) {
        throw new HttpError(409, "card_code_taken", "This card is already registered. Scan it to open the patient.");
      }
      throw error;
    }

    const linkedPatient = await linked(patient, token);
    log("info", "patient registered", { patientId: patient.id, ovokPatientId: linkedPatient.ovokPatientId, by: caller.profile });
    return json(201, { patient: linkedPatient }, { location: `${settings.publicPath}/${patient.id}` });
  }

  async function read(id: string, token: string): Promise<Response> {
    const patient = await store.findById(id);
    if (!patient) throw new HttpError(404, "patient_not_found", "No patient has this id.");
    return json(200, { patient: await linked(patient, token) });
  }

  const routes: Route[] = [
    { method: "POST", pattern: /^\/?$/, serve: (request, auth) => register(request, auth.token, auth.caller) },
    { method: "POST", pattern: /^\/_search$/, serve: (request, auth) => search(request, auth.token) },
    { method: "GET", pattern: /^\/([0-9a-f-]{36})$/i, serve: (_request, auth, match) => read(match[1] ?? "", auth.token) },
  ];

  async function route(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const path = new URL(request.url).pathname.replace(/^.*?\/patients/, "");
    const onPath = routes.filter((candidate) => candidate.pattern.test(path));
    if (onPath.length === 0) throw new HttpError(404, "route_not_found", "No such route.");

    const matched = onPath.find((candidate) => candidate.method === request.method);
    if (!matched) {
      const allow = [...onPath.map((candidate) => candidate.method), "OPTIONS"].join(", ");
      throw new HttpError(405, "method_not_allowed", "This route does not take that method.", { allow });
    }

    const auth = await authorize(request);
    return matched.serve(request, auth, path.match(matched.pattern) ?? []);
  }

  return async (request: Request) => {
    try {
      return await route(request);
    } catch (error) {
      if (error instanceof HttpError) {
        return json(error.status, { error: { code: error.code, message: error.message } }, error.headers);
      }
      if (error instanceof OvokTimeoutError) {
        log("error", "ovok request timed out", {});
        return json(504, { error: { code: "ovok_timeout", message: "Ovok did not answer in time. Try again." } });
      }
      if (error instanceof OvokUnavailableError) {
        log("error", "ovok request failed", { status: error.status });
        return json(502, { error: { code: "ovok_unavailable", message: "Ovok did not answer as expected. Try again." } });
      }
      log("error", "register request failed", { error: error instanceof Error ? error.message : String(error) });
      return json(500, { error: { code: "internal_error", message: "The register failed. Try again." } });
    }
  };
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // Falls through to the 400 below.
  }
  throw new HttpError(400, "body_invalid", "Send a JSON object.");
}

function validNewPatient(body: Record<string, unknown>): NewPatient {
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const patient = {
    cardCode: text(body.cardCode),
    givenName: text(body.givenName),
    familyName: text(body.familyName),
    birthDate: text(body.birthDate),
  };

  const problems = [
    !CARD_CODE.test(patient.cardCode) && "cardCode",
    !isName(patient.givenName) && "givenName",
    !isName(patient.familyName) && "familyName",
    !isPastDate(patient.birthDate) && "birthDate",
  ].filter((field): field is string => Boolean(field));

  if (problems.length > 0) {
    throw new HttpError(422, "patient_invalid", `Check these fields: ${problems.join(", ")}.`);
  }
  return patient;
}

function isName(value: string): boolean {
  return value.length > 0 && value.length <= NAME_MAX_LENGTH;
}

function isPastDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  const isRealDate = !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  return isRealDate && value >= EARLIEST_BIRTH_DATE && date.getTime() <= Date.now();
}
