import type { BloodPressureEntry } from "./blood-pressure";
import type { Patient } from "./patients";

/** A patient measured this shift. Held in memory only and gone at the end of the shift. */
export type ShiftVisit = {
  patient: Patient;
  latest: BloodPressureEntry;
  savedAt: string;
  readings: number;
};

/** The shift after a reading is saved: that patient moves to the front with the new reading. */
export function recordVisit(
  shift: readonly ShiftVisit[],
  patient: Patient,
  latest: BloodPressureEntry,
  savedAt: string,
): ShiftVisit[] {
  const earlier = shift.find((visit) => visit.patient.id === patient.id);
  const others = shift.filter((visit) => visit.patient.id !== patient.id);
  return [{ patient, latest, savedAt, readings: (earlier?.readings ?? 0) + 1 }, ...others];
}
