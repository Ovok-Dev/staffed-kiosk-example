import { type OvokCaller, type OvokGateway, OvokTimeoutError, OvokUnavailableError } from "./patient.ts";

type Fetch = typeof fetch;

type AuthMe = {
  project?: { id?: string };
  profile?: { resourceType?: string; id?: string };
};

const REFUSED_TOKEN_STATUSES = new Set([401, 403]);
const OVOK_TIMEOUT_MS = 10_000;

/** Ovok over HTTP: `GET /v1/auth/me` and a conditional create of a Patient that holds only the pseudonym. */
export function ovokGateway(baseUrl: string, identifierSystem: string, fetchImpl: Fetch = fetch): OvokGateway {
  const url = (path: string) => new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);

  async function send(path: string, init: RequestInit): Promise<Response> {
    try {
      return await fetchImpl(url(path), { ...init, signal: AbortSignal.timeout(OVOK_TIMEOUT_MS) });
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") throw new OvokTimeoutError();
      throw new OvokUnavailableError(null);
    }
  }

  return {
    async caller(token: string): Promise<OvokCaller | null> {
      const response = await send("v1/auth/me", {
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (REFUSED_TOKEN_STATUSES.has(response.status)) return null;
      if (!response.ok) throw new OvokUnavailableError(response.status);

      const me = (await response.json()) as AuthMe;
      const projectId = me.project?.id;
      const profile = me.profile?.resourceType && me.profile.id ? `${me.profile.resourceType}/${me.profile.id}` : null;
      return projectId && profile ? { projectId, profile } : null;
    },

    async ensurePatient(token: string, pseudonym: string): Promise<string> {
      const identifier = `${identifierSystem}|${pseudonym}`;
      const response = await send("fhir/R4/Patient", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/fhir+json",
          "if-none-exist": new URLSearchParams({ identifier }).toString(),
        },
        body: JSON.stringify({
          resourceType: "Patient",
          active: true,
          identifier: [{ system: identifierSystem, value: pseudonym }],
        }),
      });
      if (!response.ok) throw new OvokUnavailableError(response.status);

      const patient = (await response.json()) as { id?: string };
      if (!patient.id) throw new OvokUnavailableError(response.status);
      return patient.id;
    },
  };
}
