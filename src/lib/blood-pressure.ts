import type { Observation } from "@medplum/fhirtypes";

export type BloodPressureEntry = {
  systolic: number;
  diastolic: number;
  pulse: number | null;
};

export type BloodPressureReading = BloodPressureEntry & {
  id: string;
  takenAt: string;
};

export const LOINC = "http://loinc.org";
export const PANEL = "85354-9";
export const HEART_RATE = "8867-4";
const SYSTOLIC = "8480-6";
const DIASTOLIC = "8462-4";
const READING_ID_SYSTEM = "https://api.ovok.com/fhir/StructureDefinition/device-reading-id";

/** Pairs each blood-pressure panel with the pulse saved in the same reading, newest first. */
export function bloodPressureReadings(observations: readonly Observation[]): BloodPressureReading[] {
  const pulses = new Map<string, number>();
  for (const observation of observations) {
    const key = readingKey(observation);
    const value = observation.valueQuantity?.value;
    if (key && hasCode(observation, HEART_RATE) && typeof value === "number") pulses.set(key, value);
  }

  return observations
    .filter((observation) => hasCode(observation, PANEL))
    .flatMap((panel) => {
      const systolic = componentValue(panel, SYSTOLIC);
      const diastolic = componentValue(panel, DIASTOLIC);
      const takenAt = panel.effectiveDateTime;
      if (!panel.id || !takenAt || systolic === null || diastolic === null) return [];

      const key = readingKey(panel);
      return [{ id: panel.id, takenAt, systolic, diastolic, pulse: key ? (pulses.get(key) ?? null) : null }];
    })
    .sort((left, right) => right.takenAt.localeCompare(left.takenAt));
}

function hasCode(observation: Observation, code: string): boolean {
  return observation.code?.coding?.some((coding) => coding.code === code) ?? false;
}

function componentValue(panel: Observation, code: string): number | null {
  const component = panel.component?.find((candidate) => candidate.code.coding?.some((coding) => coding.code === code));
  const value = component?.valueQuantity?.value;
  return typeof value === "number" ? value : null;
}

/** The reading an observation belongs to: its reading identifier without the observation's index. */
function readingKey(observation: Observation): string | null {
  const value = observation.identifier?.find((identifier) => identifier.system === READING_ID_SYSTEM)?.value;
  return value ? value.slice(0, value.lastIndexOf("/")) : null;
}
