import { Activity, ArrowRight } from "lucide-react";

import type { ShiftVisit } from "../lib/shift";

type Props = {
  visit: ShiftVisit;
  namesHidden: boolean;
  now: number;
  onOpen: () => void;
};

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const exactTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;

/** One patient measured this shift, in the dashboard's station tile. */
export default function ShiftTile({ visit, namesHidden, now, onOpen }: Props) {
  const { patient, latest } = visit;

  return (
    <article className="station-patient">
      <button type="button" className="station-patient-heading" onClick={onOpen}>
        <span className="station-patient-name">
          <strong>{namesHidden ? "Patient" : `${patient.givenName} ${patient.familyName}`}</strong>
          <span>{namesHidden ? "Details hidden" : `Card ${patient.cardCode}`}</span>
        </span>
        <ArrowRight size={16} aria-hidden="true" />
      </button>
      <div className="station-patient-body">
        <span className="station-patient-icon" aria-hidden="true">
          <Activity size={18} />
        </span>
        <span>
          <strong>Latest reading this shift</strong>
          <time dateTime={visit.savedAt} title={exactTime.format(new Date(visit.savedAt))}>
            {sinceSaved(visit.savedAt, now)}
          </time>
        </span>
      </div>
      <footer className="station-patient-values">
        <Value label="BP" value={`${latest.systolic}/${latest.diastolic}`} unit="mmHg" />
        <Value label="Pulse" value={latest.pulse === null ? "—" : String(latest.pulse)} unit={latest.pulse === null ? "" : "bpm"} />
        <Value label="Readings" value={String(visit.readings)} unit="" />
      </footer>
    </article>
  );
}

function Value({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <span className="value-label">{label}</span>
      <span className="value">
        {value} {unit && <span className="unit-inline">{unit}</span>}
      </span>
    </div>
  );
}

function sinceSaved(savedAt: string, now: number): string {
  const minutes = Math.round((new Date(savedAt).getTime() - now) / MINUTE_MS);
  return Math.abs(minutes) < MINUTES_PER_HOUR
    ? relative.format(minutes, "minute")
    : relative.format(Math.round(minutes / MINUTES_PER_HOUR), "hour");
}
