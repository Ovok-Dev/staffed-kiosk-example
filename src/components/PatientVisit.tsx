import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, CloudOff, ShieldCheck } from "lucide-react";

import type { BloodPressureEntry, BloodPressureReading } from "../lib/blood-pressure";
import { messageFor } from "../lib/messages";
import type { Patient } from "../lib/patients";
import { recentBloodPressure, saveBloodPressure } from "../lib/readings";

type Props = {
  patient: Patient;
  onSaved: (entry: BloodPressureEntry) => void;
  onDone: () => void;
};

type Save = { state: "idle" | "saving" | "saved" | "queued" } | { state: "failed"; message: string };

type Recent = { state: "loading" } | { state: "ready"; readings: BloodPressureReading[] } | { state: "failed" };

type Fields = { systolic: string; diastolic: string; pulse: string };

const EMPTY_FIELDS: Fields = { systolic: "", diastolic: "", pulse: "" };

const dateOfBirth = new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeZone: "UTC" });
const takenAt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** Identity check, then one blood-pressure reading saved to Ovok for this patient. */
export default function PatientVisit({ patient, onSaved, onDone }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [readingId, setReadingId] = useState(() => crypto.randomUUID());
  const [save, setSave] = useState<Save>({ state: "idle" });
  const [recent, setRecent] = useState<Recent>({ state: "loading" });

  const loadRecent = useCallback(async () => {
    try {
      setRecent({ state: "ready", readings: await recentBloodPressure(patient.ovokPatientId) });
    } catch {
      setRecent({ state: "failed" });
    }
  }, [patient.ovokPatientId]);

  useEffect(() => {
    if (confirmed) void loadRecent();
  }, [confirmed, loadRecent]);

  const update = (field: keyof Fields) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setFields((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entry: BloodPressureEntry = {
      systolic: Number(fields.systolic),
      diastolic: Number(fields.diastolic),
      pulse: fields.pulse === "" ? null : Number(fields.pulse),
    };

    setSave({ state: "saving" });
    try {
      setSave({ state: await saveBloodPressure(patient.ovokPatientId, readingId, entry) });
      onSaved(entry);
      void loadRecent();
    } catch (failure) {
      setSave({ state: "failed", message: messageFor(failure) });
    }
  }

  function anotherReading() {
    setFields(EMPTY_FIELDS);
    setReadingId(crypto.randomUUID());
    setSave({ state: "idle" });
  }

  const finished = save.state === "saved" || save.state === "queued";

  return (
    <section className="panel visit" aria-labelledby="patient-name">
      <button type="button" className="back-link" onClick={onDone}>
        <ArrowLeft size={16} aria-hidden="true" />
        Scan another card
      </button>
      <header className="identity">
        <h1 id="patient-name">
          {patient.givenName} {patient.familyName}
        </h1>
        <dl className="identifiers">
          <div>
            <dt>Date of birth</dt>
            <dd>
              {dateOfBirth.format(new Date(`${patient.birthDate}T00:00:00Z`))}
              <span className="age"> · {ageOn(patient.birthDate, new Date())} years</span>
            </dd>
          </div>
          <div>
            <dt>Card</dt>
            <dd className="code">{patient.cardCode}</dd>
          </div>
        </dl>
      </header>

      {!confirmed ? (
        <div className="identity-check">
          <p>Ask the patient for their name and date of birth before you measure.</p>
          <div className="actions">
            <button type="button" className="button primary" onClick={() => setConfirmed(true)} autoFocus>
              <ShieldCheck size={20} aria-hidden="true" />
              Name and date of birth match
            </button>
            <button type="button" className="button outline" onClick={onDone}>
              Not this patient
            </button>
          </div>
        </div>
      ) : (
        <div className="record">
          <form className="reading-form" onSubmit={submit}>
            <fieldset disabled={save.state === "saving" || finished}>
              <legend>Blood pressure</legend>
              <NumberField label="Systolic" unit="mmHg" value={fields.systolic} onChange={update("systolic")} min={40} max={300} required autoFocus />
              <span className="slash" aria-hidden="true">/</span>
              <NumberField label="Diastolic" unit="mmHg" value={fields.diastolic} onChange={update("diastolic")} min={20} max={200} required />
              <NumberField label="Pulse" unit="bpm" value={fields.pulse} onChange={update("pulse")} min={20} max={250} hint="Optional" />
            </fieldset>

            {save.state === "failed" && <p className="form-error" role="alert">{save.message}</p>}

            {finished ? (
              <div className="saved" role="status">
                <span className={`saved-mark is-${save.state}`} aria-hidden="true">
                  {save.state === "saved" ? <Check size={20} strokeWidth={2.5} /> : <CloudOff size={20} />}
                </span>
                <p>
                  {save.state === "saved"
                    ? `Saved to Ovok for ${patient.givenName}.`
                    : "Kept on this tablet. It saves to Ovok when the connection is back."}
                </p>
                <div className="actions">
                  <button type="button" className="button primary" onClick={onDone} autoFocus>
                    Next patient
                  </button>
                  <button type="button" className="button outline" onClick={anotherReading}>
                    Add another reading
                  </button>
                </div>
              </div>
            ) : (
              <button className="button primary save" disabled={save.state === "saving"}>
                {save.state === "saving" ? "Saving…" : "Save reading"}
              </button>
            )}
          </form>

          <RecentReadings recent={recent} />
        </div>
      )}
    </section>
  );
}

type NumberFieldProps = {
  label: string;
  unit: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  min: number;
  max: number;
  required?: boolean;
  autoFocus?: boolean;
  hint?: string;
};

function NumberField({ label, unit, hint, ...input }: NumberFieldProps) {
  return (
    <label className="number-field">
      <span className="number-label">
        <span>
          {label}
          {hint && <span className="hint"> · {hint}</span>}
        </span>
        <span className="unit">{unit}</span>
      </span>
      <span className="number-box">
        <input type="number" inputMode="numeric" step={1} {...input} />
      </span>
    </label>
  );
}

function RecentReadings({ recent }: { recent: Recent }) {
  return (
    <section className="recent" aria-labelledby="recent-title" aria-busy={recent.state === "loading"}>
      <h2 id="recent-title">Recent readings in Ovok</h2>
      {recent.state === "loading" && (
        <div className="loading-lines" aria-hidden="true">
          <span />
          <span />
        </div>
      )}
      {recent.state === "failed" && <p className="muted">Recent readings could not be loaded.</p>}
      {recent.state === "ready" && recent.readings.length === 0 && (
        <div className="empty">
          <p className="empty-title">No readings yet</p>
          <p className="muted">Readings recorded for this patient will appear here.</p>
        </div>
      )}
      {recent.state === "ready" && recent.readings.length > 0 && (
        <div className="table-frame">
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Reading</th>
                <th scope="col" className="numeric">Value</th>
              </tr>
            </thead>
            <tbody>
              {recent.readings.map((reading) => (
                <tr key={reading.id}>
                  <td className="when">
                    <time dateTime={reading.takenAt}>{takenAt.format(new Date(reading.takenAt))}</time>
                  </td>
                  <td className="reading-name">Blood pressure</td>
                  <td className="numeric">
                    {reading.systolic}/{reading.diastolic}
                    <span className="unit-inline">mmHg</span>
                    {reading.pulse !== null && (
                      <span className="secondary-value">
                        {reading.pulse}
                        <span className="unit-inline">bpm</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ageOn(birthDate: string, day: Date): number {
  const [year = 0, month = 1, date = 1] = birthDate.split("-").map(Number);
  const hadBirthday = day.getMonth() + 1 > month || (day.getMonth() + 1 === month && day.getDate() >= date);
  return day.getFullYear() - year - (hadBirthday ? 0 : 1);
}
