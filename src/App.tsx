import { useCallback, useEffect, useState } from "react";
import type { Session } from "@ovok/core/next";

import Home from "./components/Home";
import PatientVisit from "./components/PatientVisit";
import RegisterPatient from "./components/RegisterPatient";
import SignIn from "./components/SignIn";
import StationBar from "./components/StationBar";
import { ovok } from "./lib/ovok";
import type { Patient } from "./lib/patients";
import { recordVisit, type ShiftVisit } from "./lib/shift";
import { useIdleReset } from "./lib/useIdleReset";

/** The next person at the station must never see the last patient. */
const IDLE_RESET_MS = 90_000;
const IDLE_NOTICE = "The last patient was cleared after 90 seconds without input.";

type Screen =
  | { name: "home"; notice: string | null }
  | { name: "register"; cardCode: string }
  | { name: "visit"; patient: Patient };

const HOME: Screen = { name: "home", notice: null };

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [screen, setScreen] = useState<Screen>(HOME);
  const [shift, setShift] = useState<ShiftVisit[]>([]);
  const [namesHidden, setNamesHidden] = useState(true);

  useEffect(() => {
    void ovok.session.current().then(setSession);
    return ovok.session.onChange((next) => {
      setSession(next);
      setScreen(HOME);
      setShift([]);
      setNamesHidden(true);
    });
  }, []);

  const clearStation = useCallback(() => {
    setScreen({ name: "home", notice: IDLE_NOTICE });
    setNamesHidden(true);
  }, []);
  useIdleReset(screen.name !== "home" || !namesHidden, IDLE_RESET_MS, clearStation);

  if (session === undefined) return <div className="restoring" aria-busy="true" />;
  if (session === null) return <SignIn />;

  return (
    <div className="station">
      <StationBar nurse={session.profile.display ?? "Signed in"} onEndShift={() => void ovok.auth.logout()} />
      <main className="stage">
        {screen.name === "home" && (
          <Home
            shift={shift}
            namesHidden={namesHidden}
            notice={screen.notice}
            onToggleNames={() => setNamesHidden((hidden) => !hidden)}
            onFound={(patient) => setScreen({ name: "visit", patient })}
            onRegister={(cardCode) => setScreen({ name: "register", cardCode })}
          />
        )}
        {screen.name === "register" && (
          <RegisterPatient
            cardCode={screen.cardCode}
            onRegistered={(patient) => setScreen({ name: "visit", patient })}
            onCancel={() => setScreen(HOME)}
          />
        )}
        {screen.name === "visit" && (
          <PatientVisit
            key={screen.patient.id}
            patient={screen.patient}
            onSaved={(entry) => setShift((current) => recordVisit(current, screen.patient, entry, new Date().toISOString()))}
            onDone={() => setScreen(HOME)}
          />
        )}
      </main>
    </div>
  );
}
