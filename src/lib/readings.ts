import { type BloodPressureMeasurement, MeasurementTypeKey } from "@ovok/core/next";

import { type BloodPressureEntry, type BloodPressureReading, bloodPressureReadings, HEART_RATE, LOINC, PANEL } from "./blood-pressure";
import { ovok } from "./ovok";

export type SaveOutcome = "saved" | "queued";

const RECENT_READINGS = 3;
/** Each reading stores a panel and a pulse, so fetch both for every reading shown. */
const OBSERVATIONS_PER_READING = 2;

/**
 * Saves one blood pressure for the patient. `readingId` is fixed per form, so a retry after a dropped
 * connection finds the first save instead of storing the reading twice.
 */
export async function saveBloodPressure(
  ovokPatientId: string,
  readingId: string,
  entry: BloodPressureEntry,
): Promise<SaveOutcome> {
  const measurement: BloodPressureMeasurement = {
    measurementTypeKey: MeasurementTypeKey.bloodPressure,
    systolic: entry.systolic,
    diastolic: entry.diastolic,
    ...(entry.pulse === null ? {} : { heartRate: entry.pulse }),
  };
  const result = await ovok.measurements.save({
    patientId: ovokPatientId,
    sourceId: readingId,
    effectiveDateTime: new Date(),
    measurement,
  });
  return result.status;
}

export async function recentBloodPressure(ovokPatientId: string): Promise<BloodPressureReading[]> {
  const page = await ovok.fhir.search("Observation", {
    subject: `Patient/${ovokPatientId}`,
    code: `${LOINC}|${PANEL},${LOINC}|${HEART_RATE}`,
    _sort: "-date",
    _count: RECENT_READINGS * OBSERVATIONS_PER_READING,
  });
  return bloodPressureReadings(page.data).slice(0, RECENT_READINGS);
}

/** Blood-pressure readings saved in the project since local midnight, as far as the nurse may see. */
export async function bloodPressureCountToday(): Promise<number | null> {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const page = await ovok.fhir.search("Observation", {
    code: `${LOINC}|${PANEL}`,
    date: `ge${midnight.toISOString()}`,
    _summary: "count",
  });
  return page.total;
}
