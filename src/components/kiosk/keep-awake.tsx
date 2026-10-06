"use client";

import { useEffect } from "react";
import { useDevicePrefs } from "@/hooks/use-device-prefs";

/**
 * Wall display: asks the browser to keep the screen on (Screen Wake Lock API),
 * so the OS never blanks it. The in-app night mode dims it instead.
 */
export function KeepAwake() {
  const [prefs] = useDevicePrefs();

  useEffect(() => {
    if (!prefs.kiosk || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== "visible" || lock) return;
      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await lock.release();
          return;
        }
        lock.addEventListener("release", () => {
          lock = null;
        });
      } catch {
        // Not allowed (e.g. not a secure context) – nothing else to do.
      }
    };

    void acquire();
    const onVisible = () => void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [prefs.kiosk]);

  return null;
}
