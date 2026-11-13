import { Hl7Message } from "@medplum/core";
import { describe, expect, it } from "vitest";

import { MalformedMessageError, readingsFromOru } from "../receiver/oru";

const PSEUDONYM = "998e65fd-12c5-4675-b614-1ed103b88291";

function message(...segments: string[]): Hl7Message {
  return Hl7Message.parse(segments.join("\r"));
}

const MSH =
  "MSH|^~\\&|OVOK||||20261113000630+0000||ORU^R01^ORU_R01|obs-panel-1|P|2.6|||AL|NE||UNICODE UTF-8|||IHE_PCD_001^IHE PCD^1.3.6.1.4.1.19376.1.6.1.1.1^ISO";
const PID = `PID|1||${PSEUDONYM}^^^https://kiosk.example.org/patient-id^MR`;
const OBR = "OBR|1||obs-panel-1^OVOK|182777000^monitoring of patient^SNOMED-CT|||20261113000600+0000";
const SYSTOLIC = "OBX|1|NM|8480-6^Systolic blood pressure^LN|1.0.0.1|126|mm[Hg]^mm[Hg]^UCUM|||||F|||20261113000600+0000";
const DIASTOLIC = "OBX|2|NM|8462-4^Diastolic blood pressure^LN|1.0.0.2|81|mm[Hg]^mm[Hg]^UCUM|||||F|||20261113000600+0000";

describe("readingsFromOru", () => {
  it("files each numeric OBX under the message's control id and pseudonym", () => {
    expect(readingsFromOru(message(MSH, PID, OBR, SYSTOLIC, DIASTOLIC))).toEqual([
      {
        controlId: "obs-panel-1",
        setId: 1,
        pseudonym: PSEUDONYM,
        code: "8480-6",
        codeSystem: "LN",
        display: "Systolic blood pressure",
        value: 126,
        unit: "mm[Hg]",
        observedAt: "2026-11-13T00:06:00+00:00",
      },
      {
        controlId: "obs-panel-1",
        setId: 2,
        pseudonym: PSEUDONYM,
        code: "8462-4",
        codeSystem: "LN",
        display: "Diastolic blood pressure",
        value: 81,
        unit: "mm[Hg]",
        observedAt: "2026-11-13T00:06:00+00:00",
      },
    ]);
  });

  it("skips values that are not numeric", () => {
    const text = "OBX|3|ST|8867-4^Heart rate^LN||irregular||||||F|||20261113000600+0000";
    expect(readingsFromOru(message(MSH, PID, OBR, text))).toEqual([]);
  });

  it("refuses a message without a patient", () => {
    expect(() => readingsFromOru(message(MSH, OBR, SYSTOLIC))).toThrow(MalformedMessageError);
  });

  it("refuses a value without an observation time", () => {
    const untimed = SYSTOLIC.replace("|||20261113000600+0000", "|||");
    expect(() => readingsFromOru(message(MSH, PID, OBR, untimed))).toThrow(MalformedMessageError);
  });
});
