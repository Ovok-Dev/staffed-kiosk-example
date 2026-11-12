import { useEffect } from "react";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "input"] as const;

/** Calls `onIdle` once nobody has touched the station for `idleMs` while `active` is true. */
export function useIdleReset(active: boolean, idleMs: number, onIdle: () => void): void {
  useEffect(() => {
    if (!active) return;

    let timer = window.setTimeout(onIdle, idleMs);
    const restart = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(onIdle, idleMs);
    };

    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, restart, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, restart));
    };
  }, [active, idleMs, onIdle]);
}
