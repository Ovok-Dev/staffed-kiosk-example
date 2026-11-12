import { useRef, useState } from "react";
import { UserPlus } from "lucide-react";

import { messageFor } from "../lib/messages";
import { findPatient, type Patient } from "../lib/patients";

type Props = {
  notice: string | null;
  onFound: (patient: Patient) => void;
  onRegister: (cardCode: string) => void;
};

/** A barcode scanner types the code and presses Enter, so the field is a plain form. */
export default function ScanCard({ notice, onFound, onRegister }: Props) {
  const [cardCode, setCardCode] = useState("");
  const [unknownCard, setUnknownCard] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function lookUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = cardCode.trim();
    if (!code) return;

    setBusy(true);
    setError(null);
    setUnknownCard(null);
    try {
      const patient = await findPatient(code);
      if (patient) {
        onFound(patient);
        return;
      }
      setUnknownCard(code);
      setCardCode("");
    } catch (failure) {
      setError(messageFor(failure));
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  return (
    <section className="scan-card" aria-labelledby="scan-title" onClick={() => input.current?.focus()}>
      <h2 id="scan-title">Scan the patient's card</h2>
      <p className="lede">Or type the card code and press Enter.</p>

      <form className="scan-form" onSubmit={lookUp}>
        <label className="visually-hidden" htmlFor="card-code">
          Card code
        </label>
        <span className="viewfinder">
          <input
            id="card-code"
            ref={input}
            className="card-input"
            value={cardCode}
            onChange={(event) => setCardCode(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="WARD-0042"
            autoFocus
            aria-describedby="scan-status"
          />
        </span>
        <button className="button primary" disabled={busy || cardCode.trim().length === 0}>
          {busy ? "Looking up…" : "Find patient"}
        </button>
      </form>

      <div id="scan-status" className="scan-status" aria-live="polite">
        {error && <p className="form-error">{error}</p>}
        {unknownCard && (
          <div className="unknown-card">
            <p>
              No patient has card <strong className="code">{unknownCard}</strong>.
            </p>
            <button type="button" className="button outline" onClick={() => onRegister(unknownCard)}>
              <UserPlus size={18} aria-hidden="true" />
              Register this card
            </button>
          </div>
        )}
        {!error && !unknownCard && notice && <p className="notice">{notice}</p>}
      </div>
    </section>
  );
}
