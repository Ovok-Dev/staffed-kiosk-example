import { describe, expect, it, vi } from "vitest";

import { patientsHandler } from "../supabase/functions/patients/handler.ts";
import { ovokGateway } from "../supabase/functions/patients/ovok-gateway.ts";
import {
  DuplicateCardError,
  type OvokCaller,
  type OvokGateway,
  OvokTimeoutError,
  OvokUnavailableError,
  type PatientRecord,
  type PatientStore,
} from "../supabase/functions/patients/patient.ts";

const PROJECT_ID = "project-1";
const NURSE: OvokCaller = { projectId: PROJECT_ID, profile: "Practitioner/nurse-1" };
const BASE = "http://localhost:54321/functions/v1/patients";
const PSEUDONYM = "6f9d7f8e-2b1a-4c3d-9e8f-0a1b2c3d4e5f";
const LINKED: PatientRecord = {
  id: PSEUDONYM,
  cardCode: "WARD-0042",
  givenName: "Mara",
  familyName: "Synthetic",
  birthDate: "1951-04-09",
  ovokPatientId: "ovok-patient-1",
};
const NEW_PATIENT = { cardCode: "WARD-0043", givenName: "Ivo", familyName: "Synthetic", birthDate: "1948-11-30" };

function fakeStore(rows: PatientRecord[] = [LINKED]): PatientStore {
  return {
    findByCard: vi.fn(async (cardCode: string) => rows.find((row) => row.cardCode === cardCode) ?? null),
    findById: vi.fn(async (id: string) => rows.find((row) => row.id === id) ?? null),
    insert: vi.fn(async (patient) => {
      if (rows.some((row) => row.cardCode === patient.cardCode)) throw new DuplicateCardError();
      return { ...patient, id: PSEUDONYM, ovokPatientId: null };
    }),
    linkOvokPatient: vi.fn(async () => undefined),
  };
}

function fakeOvok(caller: OvokCaller | null = NURSE): OvokGateway {
  return {
    caller: vi.fn(async () => caller),
    ensurePatient: vi.fn(async () => "ovok-patient-new"),
  };
}

function handler(store = fakeStore(), ovok = fakeOvok()) {
  return patientsHandler({
    store,
    ovok,
    settings: { ovokProjectId: PROJECT_ID, publicPath: "/functions/v1/patients" },
    log: () => undefined,
  });
}

function post(path: string, body: unknown, token: string | null = "token") {
  return new Request(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("patients function: access", () => {
  it("asks for a bearer token when none is sent", async () => {
    const response = await handler()(post("/_search", { cardCode: "WARD-0042" }, null));
    expect([response.status, response.headers.get("www-authenticate")]).toEqual([401, "Bearer"]);
  });

  it("answers 401 when Ovok refuses the token", async () => {
    const response = await handler(fakeStore(), fakeOvok(null))(post("/_search", { cardCode: "WARD-0042" }));
    expect(response.status).toBe(401);
  });

  it("refuses a practitioner of another project", async () => {
    const outsider = { projectId: "project-2", profile: "Practitioner/nurse-9" };
    const response = await handler(fakeStore(), fakeOvok(outsider))(post("/_search", { cardCode: "WARD-0042" }));
    expect(response.status).toBe(403);
  });

  it("refuses a patient token", async () => {
    const patient = { projectId: PROJECT_ID, profile: "Patient/p-1" };
    const response = await handler(fakeStore(), fakeOvok(patient))(post("/_search", { cardCode: "WARD-0042" }));
    expect(response.status).toBe(403);
  });

  it("answers a CORS preflight without a token", async () => {
    const response = await handler()(new Request(`${BASE}/_search`, { method: "OPTIONS" }));
    expect([response.status, response.headers.get("access-control-allow-origin")]).toEqual([204, "*"]);
  });
});

describe("patients function: search", () => {
  it("finds a patient by card code", async () => {
    const response = await handler()(post("/_search", { cardCode: " WARD-0042 " }));
    expect(await response.json()).toEqual({ patient: LINKED });
  });

  it("creates the Ovok Patient for a row that has none", async () => {
    const store = fakeStore([{ ...LINKED, ovokPatientId: null }]);
    await handler(store)(post("/_search", { cardCode: "WARD-0042" }));
    expect(store.linkOvokPatient).toHaveBeenCalledWith(PSEUDONYM, "ovok-patient-new");
  });

  it("answers 404 for an unknown card", async () => {
    const response = await handler()(post("/_search", { cardCode: "WARD-9999" }));
    expect(response.status).toBe(404);
  });

  it("answers 422 for a card code with spaces inside", async () => {
    const response = await handler()(post("/_search", { cardCode: "WARD 42" }));
    expect(response.status).toBe(422);
  });

  it("answers 400 for a body that is not JSON", async () => {
    const response = await handler()(post("/_search", "card=WARD-0042"));
    expect(response.status).toBe(400);
  });

  it("answers 502 when Ovok is down", async () => {
    const ovok = fakeOvok();
    vi.mocked(ovok.caller).mockRejectedValue(new OvokUnavailableError(503));
    const response = await handler(fakeStore(), ovok)(post("/_search", { cardCode: "WARD-0042" }));
    expect(response.status).toBe(502);
  });

  it("answers 504 when Ovok does not answer in time", async () => {
    const ovok = fakeOvok();
    vi.mocked(ovok.caller).mockRejectedValue(new OvokTimeoutError());
    const response = await handler(fakeStore(), ovok)(post("/_search", { cardCode: "WARD-0042" }));
    expect(response.status).toBe(504);
  });
});

describe("patients function: register and read", () => {
  it("registers a patient and points Location at it", async () => {
    const response = await handler()(post("", NEW_PATIENT));
    expect([response.status, response.headers.get("location")]).toEqual([201, `/functions/v1/patients/${PSEUDONYM}`]);
  });

  it("answers 409 when the card is taken", async () => {
    const response = await handler()(post("", { ...NEW_PATIENT, cardCode: "WARD-0042" }));
    expect(response.status).toBe(409);
  });

  it("answers 422 for a birth date in the future", async () => {
    const response = await handler()(post("", { ...NEW_PATIENT, birthDate: "2999-01-01" }));
    expect(response.status).toBe(422);
  });

  it("answers 422 for a date that does not exist", async () => {
    const response = await handler()(post("", { ...NEW_PATIENT, birthDate: "1950-02-30" }));
    expect(response.status).toBe(422);
  });

  it("reads a patient by pseudonym", async () => {
    const response = await handler()(
      new Request(`${BASE}/${PSEUDONYM}`, { headers: { authorization: "Bearer token" } }),
    );
    expect(await response.json()).toEqual({ patient: LINKED });
  });

  it("names the allowed methods on a wrong one", async () => {
    const response = await handler()(new Request(`${BASE}/_search`, { headers: { authorization: "Bearer token" } }));
    expect([response.status, response.headers.get("allow")]).toEqual([405, "POST, OPTIONS"]);
  });

  it("answers 404 for an unknown route", async () => {
    const response = await handler()(post("/export", {}));
    expect(response.status).toBe(404);
  });
});

describe("ovok gateway", () => {
  const SYSTEM = "https://kiosk.example.org/patient-id";

  function respond(status: number, body: unknown) {
    return vi.fn(async () => new Response(JSON.stringify(body), { status }));
  }

  it("reads the caller's project and profile from auth/me", async () => {
    const fetchImpl = respond(200, { project: { id: PROJECT_ID }, profile: { resourceType: "Practitioner", id: "nurse-1" } });
    expect(await ovokGateway("https://api.example.org", SYSTEM, fetchImpl).caller("token")).toEqual(NURSE);
  });

  it("reports an unreachable Ovok as unavailable", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(ovokGateway("https://api.example.org", SYSTEM, fetchImpl).caller("token")).rejects.toBeInstanceOf(OvokUnavailableError);
  });

  it("treats a refused token as no caller", async () => {
    const fetchImpl = respond(401, {});
    expect(await ovokGateway("https://api.example.org", SYSTEM, fetchImpl).caller("token")).toBeNull();
  });

  it("creates the Patient only if none carries the pseudonym", async () => {
    const fetchImpl = respond(201, { id: "ovok-patient-1" });
    await ovokGateway("https://api.example.org", SYSTEM, fetchImpl).ensurePatient("token", PSEUDONYM);
    const init = (fetchImpl.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(new Headers(init.headers).get("if-none-exist")).toBe(new URLSearchParams({ identifier: `${SYSTEM}|${PSEUDONYM}` }).toString());
  });

  it("sends Ovok a Patient with no name, birth date or contact", async () => {
    const fetchImpl = respond(201, { id: "ovok-patient-1" });
    await ovokGateway("https://api.example.org", SYSTEM, fetchImpl).ensurePatient("token", PSEUDONYM);
    const init = (fetchImpl.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(Object.keys(JSON.parse(init.body as string)).sort()).toEqual(["active", "identifier", "resourceType"]);
  });
});
