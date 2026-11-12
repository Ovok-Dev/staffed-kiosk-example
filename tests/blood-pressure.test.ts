import type { Observation } from "@medplum/fhirtypes";
import { describe, expect, it } from "vitest";

import { bloodPressureReadings } from "../src/lib/blood-pressure";

const READING_ID_SYSTEM = "https://api.ovok.com/fhir/StructureDefinition/device-reading-id";

function panel(id: string, reading: string, takenAt: string, systolic: number, diastolic: number): Observation {
  return {
    resourceType: "Observation",
    id,
    status: "final",
    code: { coding: [{ system: "http://loinc.org", code: "85354-9" }] },
    effectiveDateTime: takenAt,
    identifier: [{ system: READING_ID_SYSTEM, value: `Patient/p1/${reading}/3` }],
    component: [
      { code: { coding: [{ code: "8480-6" }] }, valueQuantity: { value: systolic, unit: "mm[Hg]" } },
      { code: { coding: [{ code: "8462-4" }] }, valueQuantity: { value: diastolic, unit: "mm[Hg]" } },
    ],
  };
}

function pulse(reading: string, value: number): Observation {
  return {
    resourceType: "Observation",
    status: "final",
    code: { coding: [{ code: "8885-6" }, { code: "8867-4" }] },
    identifier: [{ system: READING_ID_SYSTEM, value: `Patient/p1/${reading}/2` }],
    valueQuantity: { value, unit: "/min" },
  };
}

describe("bloodPressureReadings", () => {
  it("pairs each panel with the pulse of the same reading, newest first", () => {
    const observations = [
      panel("older", "r1", "2026-11-12T08:10:00Z", 131, 84),
      pulse("r2", 66),
      panel("newer", "r2", "2026-11-12T14:32:00Z", 124, 79),
      pulse("r1", 72),
    ];
    expect(bloodPressureReadings(observations)).toEqual([
      { id: "newer", takenAt: "2026-11-12T14:32:00Z", systolic: 124, diastolic: 79, pulse: 66 },
      { id: "older", takenAt: "2026-11-12T08:10:00Z", systolic: 131, diastolic: 84, pulse: 72 },
    ]);
  });

  it("shows a reading without a pulse when none was saved", () => {
    const [reading] = bloodPressureReadings([panel("only", "r3", "2026-11-12T09:00:00Z", 118, 76)]);
    expect(reading?.pulse).toBeNull();
  });

  it("skips a panel that is missing a pressure", () => {
    const broken = { ...panel("broken", "r4", "2026-11-12T09:00:00Z", 118, 76), component: [] };
    expect(bloodPressureReadings([broken])).toEqual([]);
  });
});
