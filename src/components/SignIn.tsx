import { useState } from "react";
import type { LoginResult, MfaChallenge } from "@ovok/core/next";

import { config } from "../lib/config";
import { messageFor } from "../lib/messages";
import { ovok } from "../lib/ovok";
import Wordmark from "./Wordmark";

/** The nurse signs in once per shift with their Ovok practitioner account. */
export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result: LoginResult = challenge
        ? await ovok.auth.verifyMfa(challenge, code.trim())
        : await ovok.auth.login({ profileType: "Practitioner", email: email.trim(), password });
      setPassword("");
      if (result.status === "mfa-required") setChallenge(result.challenge);
    } catch (failure) {
      setError(messageFor(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-intro" aria-labelledby="auth-heading">
        <Wordmark />
        <div className="intro-copy">
          <h1 id="auth-heading">
            Readings at the <span>bedside</span>
          </h1>
          <p className="intro-description">
            One sign-in per shift. Scan each patient's card, check who they are, and save the reading for them.
          </p>
        </div>
        <p className="platform-note">{config.stationName} · Practitioner access through Ovok</p>
      </section>

      <section className="auth-panel" aria-label="Start your shift">
        <form className="auth-form" onSubmit={submit}>
          <div className="form-heading">
            <h2>{challenge ? "Verify it's you" : "Start your shift"}</h2>
            <p>
              {challenge
                ? "Enter the code from your authenticator app."
                : "Sign in with your Ovok practitioner account. Patients never sign in here."}
            </p>
          </div>

          {challenge ? (
            <label className="field">
              <span>Verification code</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
                autoFocus
              />
            </label>
          ) : (
            <>
              <label className="field">
                <span>Email address</span>
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoFocus
                />
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
            </>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button primary" disabled={busy}>
            {busy ? "Checking…" : challenge ? "Verify and start" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
