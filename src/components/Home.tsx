import { useEffect, useState } from "react";
import { Eye, EyeOff, UserRoundPlus, UsersRound } from "lucide-react";

import type { Patient } from "../lib/patients";
import { bloodPressureCountToday } from "../lib/readings";
import type { ShiftVisit } from "../lib/shift";
import ScanCard from "./ScanCard";
import ShiftTile from "./ShiftTile";

type Props = {
  shift: ShiftVisit[];
  namesHidden: boolean;
  notice: string | null;
  onToggleNames: () => void;
  onFound: (patient: Patient) => void;
  onRegister: (cardCode: string) => void;
};

/** Relative times on the tiles move on once a minute. */
const CLOCK_TICK_MS = 60_000;

const today = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" });

/** The station board: this shift's tiles on the left, the scan rail on the right. */
export default function Home({ shift, namesHidden, notice, onToggleNames, onFound, onRegister }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [readingsToday, setReadingsToday] = useState<number | null>(null);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    bloodPressureCountToday()
      .then(setReadingsToday)
      .catch(() => setReadingsToday(null));
  }, []);

  const shiftReadings = shift.reduce((total, visit) => total + visit.readings, 0);

  return (
    <div className="home">
      <header className="home-header">
        <div>
          <h1>Home</h1>
          <p className="muted">{today.format(now)}</p>
        </div>
        <button type="button" className="button outline" onClick={() => onRegister("")}>
          <UserRoundPlus size={18} aria-hidden="true" />
          Register patient
        </button>
      </header>

      <div className="station-overview">
        <aside className="scan-rail" aria-label="Next patient">
          <ScanCard notice={notice} onFound={onFound} onRegister={onRegister} />
          <ol className="station-steps">
            <li>
              <span>
                <strong>Scan</strong> the patient's card
              </span>
            </li>
            <li>
              <span>
                <strong>Check</strong> name and date of birth with them
              </span>
            </li>
            <li>
              <span>
                <strong>Record</strong> the reading and hand over
              </span>
            </li>
          </ol>
        </aside>

        <section className="station-board" aria-labelledby="shift-title">
          <div className="metric-row">
            <Metric label="Readings this shift" value={shiftReadings} caption="Saved from this station" />
            <Metric label="Patients this shift" value={shift.length} caption="Names hidden until shown" />
            <Metric label="Today in Ovok" value={readingsToday} caption="Blood-pressure readings" />
          </div>

          <div className="station-toolbar">
            <h2 id="shift-title" className="toolbar-title">
              <UsersRound size={16} aria-hidden="true" />
              This shift
            </h2>
            {shift.length > 0 && (
              <button type="button" className="button outline compact" onClick={onToggleNames} aria-pressed={!namesHidden}>
                {namesHidden ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
                {namesHidden ? "Show names" : "Hide names"}
              </button>
            )}
          </div>

          {shift.length === 0 ? (
            <div className="empty">
              <span className="empty-media" aria-hidden="true">
                <UsersRound size={18} />
              </span>
              <p className="empty-title">No patients yet this shift</p>
              <p className="muted">Each patient you measure gets a tile here, with names hidden until you show them.</p>
            </div>
          ) : (
            <div className="station-patient-grid">
              {shift.map((visit) => (
                <ShiftTile
                  key={visit.patient.id}
                  visit={visit}
                  namesHidden={namesHidden}
                  now={now}
                  onOpen={() => onFound(visit.patient)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, caption }: { label: string; value: number | null; caption: string }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value ?? "–"}</span>
      <span className="metric-caption">{caption}</span>
    </div>
  );
}
