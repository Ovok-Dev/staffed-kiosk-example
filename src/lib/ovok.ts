import { Ovok } from "@ovok/core/next";

import { config } from "./config";

/** Renew a token this close to its expiry before handing it to the register. */
const TOKEN_MARGIN_MS = 60_000;

/** The nurse's session lasts until the tab closes, so a reload mid-shift keeps them signed in. */
export const ovok = new Ovok({
  baseUrl: config.ovokBaseUrl,
  tenantCode: config.tenantCode,
  fhirPath: "/fhir/R4/",
  storage: window.sessionStorage,
  timeoutMs: 15_000,
});

export class SignedOutError extends Error {
  constructor() {
    super("Sign in to Ovok to continue.");
  }
}

/** A current access token for calls Ovok's client does not make itself. */
export async function accessToken(): Promise<string> {
  const session = await ovok.session.current();
  if (!session) throw new SignedOutError();
  if (session.expiresAt - Date.now() > TOKEN_MARGIN_MS) return session.accessToken;

  await ovok.auth.me();
  const renewed = await ovok.session.current();
  if (!renewed) throw new SignedOutError();
  return renewed.accessToken;
}
