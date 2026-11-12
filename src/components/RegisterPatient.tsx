import { useState } from "react";
import { ArrowLeft } from "lucide-react";

import { messageFor } from "../lib/messages";
import { type NewPatient, type Patient, registerPatient } from "../lib/patients";

type Props = {
  cardCode: string;
  onRegistered: (patient: Patient) => void;
  onCancel: () => void;
};

const today = () => new Date().toISOString().slice(0, 10);

/** Adds a patient to the register in Supabase; Ovok gets only a Patient that carries the register's id. */
export default function RegisterPatient({ cardCode, onRegistered, onCancel }: Props) {
  const [patient, setPatient] = useState<NewPatient>({ cardCode, givenName: "", familyName: "", birthDate: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (field: keyof NewPatient) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setPatient((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onRegistered(await registerPatient(patient));
    } catch (failure) {
      setError(messageFor(failure));
      setBusy(false);
    }
  }

  return (
    <section className="panel register" aria-labelledby="register-title">
      <button type="button" className="back-link" onClick={onCancel}>
        <ArrowLeft size={16} aria-hidden="true" />
        Back to scanning
      </button>
      <h1 id="register-title">Register a patient</h1>
      <p className="lede">The name and date of birth stay in your Supabase register. Ovok only stores readings.</p>

      <form className="form register-form" onSubmit={submit}>
        <label className="field">
          <span>Given name</span>
          <input value={patient.givenName} onChange={update("givenName")} autoComplete="off" required maxLength={100} autoFocus />
        </label>
        <label className="field">
          <span>Family name</span>
          <input value={patient.familyName} onChange={update("familyName")} autoComplete="off" required maxLength={100} />
        </label>
        <label className="field">
          <span>Date of birth</span>
          <input type="date" value={patient.birthDate} onChange={update("birthDate")} required min="1900-01-01" max={today()} />
        </label>
        <label className="field">
          <span>Card code</span>
          <input
            className="code"
            value={patient.cardCode}
            onChange={update("cardCode")}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            pattern="[A-Za-z0-9\-]{4,64}"
            title="4 to 64 letters, digits or dashes"
          />
        </label>
        {error && <p className="form-error wide" role="alert">{error}</p>}
        <button className="button primary wide" disabled={busy}>
          {busy ? "Registering…" : "Register and continue"}
        </button>
      </form>
    </section>
  );
}
