"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { WeatherIcon } from "@/components/weather/weather-icon";
import { useSettings } from "@/data/settings";
import { useForecast } from "@/data/weather";
import { useDevicePrefs } from "@/hooks/use-device-prefs";
import { useNow } from "@/hooks/use-now";
import { formatLongDate, formatTime } from "@/lib/date";
import { isAsleepAt } from "@/lib/sleep";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/**
 * Calm night mode for the wall display: after a few minutes without touch the
 * dashboard fades to a dim clock (only during sleep hours, or always). Tap to
 * wake – the waking tap never reaches the UI underneath.
 */
export function Screensaver() {
  const [prefs] = useDevicePrefs();
  const { settings } = useSettings();
  const now = useNow("minute");
  const forecast = useForecast(settings.location);
  const [idle, setIdle] = useState(false);

  const enabled = prefs.kiosk && prefs.screensaver !== "off";

  useEffect(() => {
    if (!enabled) return;
    let last = Date.now();
    const onActivity = () => {
      last = Date.now();
      setIdle(false);
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true, capture: true }));
    const timer = window.setInterval(() => {
      setIdle(Date.now() - last >= prefs.screensaverDelay * 60_000);
    }, 5_000);
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }));
      window.clearInterval(timer);
    };
  }, [enabled, prefs.screensaverDelay]);

  const asleep = now ? isAsleepAt(settings.sleepSchedule, now) : false;
  const show = enabled && idle && (prefs.screensaver === "always" || asleep);

  // Slowly move the clock around (new position every minute) to avoid burn-in.
  const seed = now ? Math.floor(now.getTime() / 60_000) : 0;
  const drift = { x: Math.sin(seed * 12.9898) * 60, y: Math.cos(seed * 78.233) * 40 };

  useEffect(() => {
    if (show && document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, [show]);

  const current = forecast.data?.current;

  return (
    <AnimatePresence>
      {show && now && (
        <motion.div
          role="button"
          aria-label="Wake up the dashboard"
          className="fixed inset-0 z-[200] grid place-items-center bg-black text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
          transition={{ duration: 1.6 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIdle(false);
          }}
        >
          <motion.div
            className="flex flex-col items-center gap-3 text-center"
            animate={{ x: drift.x, y: drift.y }}
            transition={{ duration: 8, ease: "easeInOut" }}
          >
            <div className="text-[clamp(6rem,16vw,15rem)] leading-none font-extralight tracking-tight text-white/45 tabular">
              {formatTime(now)}
            </div>
            <div className="text-xl font-light text-white/30 md:text-2xl">{formatLongDate(now)}</div>
            {current && (
              <div className="mt-4 flex items-center gap-2 text-2xl font-light text-white/30">
                <WeatherIcon code={current.code} isDay={current.isDay} className="size-12 opacity-50" />
                <span className="tabular">{Math.round(current.temperature)}°</span>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
