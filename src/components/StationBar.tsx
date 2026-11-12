import { LogOut } from "lucide-react";

import { config } from "../lib/config";
import Wordmark from "./Wordmark";

type Props = {
  nurse: string;
  onEndShift: () => void;
};

export default function StationBar({ nurse, onEndShift }: Props) {
  return (
    <header className="station-bar">
      <div className="station-identity">
        <Wordmark />
        <span className="station-label">{config.stationName}</span>
      </div>
      <div className="shift">
        <span className="nurse">
          <span className="presence" aria-hidden="true" />
          {nurse}
        </span>
        <button type="button" className="button outline compact" onClick={onEndShift}>
          <LogOut size={16} aria-hidden="true" />
          End shift
        </button>
      </div>
    </header>
  );
}
