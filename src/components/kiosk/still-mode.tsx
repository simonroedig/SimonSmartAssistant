"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useDevicePrefs } from "@/hooks/use-device-prefs";
import { getServerStill, getStill, setStill, subscribeStill } from "@/lib/still";

/** How long the wall display waits after the last touch before it holds still. */
const STILL_AFTER = 2 * 60_000;
const ACTIVITY = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;

/** Wall display: nothing moves while nobody is using it (see src/lib/still.ts). */
export function StillMode() {
  const [prefs] = useDevicePrefs();

  useEffect(() => {
    if (!prefs.kiosk) return;
    let timer = 0;
    const wake = () => {
      setStill(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setStill(true), STILL_AFTER);
    };
    wake();
    ACTIVITY.forEach((e) => window.addEventListener(e, wake, { passive: true, capture: true }));
    return () => {
      window.clearTimeout(timer);
      ACTIVITY.forEach((e) => window.removeEventListener(e, wake, { capture: true }));
      setStill(false);
    };
  }, [prefs.kiosk]);

  return null;
}

/** Whether the page holds still right now (always false outside the wall display). */
export function useStill() {
  return useSyncExternalStore(subscribeStill, getStill, getServerStill);
}
