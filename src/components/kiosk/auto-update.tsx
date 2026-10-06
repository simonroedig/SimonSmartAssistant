"use client";

import { useEffect } from "react";
import { useDevicePrefs } from "@/hooks/use-device-prefs";
import { BUILD_ID } from "@/lib/env";

const CHECK_EVERY = 5 * 60_000;
const IDLE_BEFORE_RELOAD = 60_000;

/**
 * Wall display only: reloads automatically when a new version is deployed
 * (after a minute without touch), and once every night to stay fresh.
 */
export function AutoUpdate() {
  const [prefs] = useDevicePrefs();

  useEffect(() => {
    if (!prefs.kiosk) return;
    let lastActivity = Date.now();
    let updateReady = false;
    const loadedAt = Date.now();

    const onActivity = () => {
      lastActivity = Date.now();
    };
    window.addEventListener("pointerdown", onActivity, { passive: true, capture: true });
    window.addEventListener("keydown", onActivity, { capture: true });

    const check = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { buildId } = (await res.json()) as { buildId?: string };
        if (buildId && buildId !== "dev" && buildId !== BUILD_ID) updateReady = true;
      } catch {
        // offline – try again later
      }
    };

    const tick = () => {
      const idle = Date.now() - lastActivity > IDLE_BEFORE_RELOAD;
      const hour = new Date().getHours();
      const nightlyDue = hour === 4 && Date.now() - loadedAt > 2 * 60 * 60_000;
      if (idle && (updateReady || nightlyDue) && navigator.onLine) window.location.reload();
    };

    const checkTimer = window.setInterval(check, CHECK_EVERY);
    const tickTimer = window.setInterval(tick, 15_000);
    void check();

    return () => {
      window.clearInterval(checkTimer);
      window.clearInterval(tickTimer);
      window.removeEventListener("pointerdown", onActivity, { capture: true });
      window.removeEventListener("keydown", onActivity, { capture: true });
    };
  }, [prefs.kiosk]);

  return null;
}
