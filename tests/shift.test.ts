import { describe, expect, it } from "vitest";

import type { Patient } from "../src/lib/patients";
import { recordVisit, type ShiftVisit } from "../src/lib/shift";

const mara: Patient = {
  id: "p-1",
  cardCode: "WARD-0042",
  givenName: "Mara",
  familyName: "Test",
  birthDate: "1951-04-09",
  ovokPatientId: "ovok-1",
};
const ivo: Patient = { ...mara, id: "p-2", cardCode: "WARD-0043", givenName: "Ivo", ovokPatientId: "ovok-2" };
const reading = { systolic: 124, diastolic: 79, pulse: 66 };

describe("recordVisit", () => {
  it("puts the patient just measured first", () => {
    const shift = recordVisit(recordVisit([], mara, reading, "08:00"), ivo, reading, "08:10");
    expect(shift.map((visit) => visit.patient.id)).toEqual(["p-2", "p-1"]);
  });

  it("counts a second reading for the same patient instead of adding a tile", () => {
    const shift: ShiftVisit[] = recordVisit(recordVisit([], mara, reading, "08:00"), mara, reading, "08:30");
    expect(shift.map((visit) => visit.readings)).toEqual([2]);
  });
});
