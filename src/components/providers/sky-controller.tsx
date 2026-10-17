"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useForecast } from "@/data/weather";
import { useSettings } from "@/data/settings";
import { useDevicePrefs } from "@/hooks/use-device-prefs";
import { useNow } from "@/hooks/use-now";
import { toDayKey } from "@/lib/date";
import { readSunTimes, SKY_STORAGE_KEY } from "@/lib/device";
import { CALM_LAYOUT, computeSky, SKY_VARS, skyWeather, type SkyLayout } from "@/lib/sky";
import { isoToMinutes } from "@/lib/weather/open-meteo";

/**
 * Aurora Sky: keeps the sky on <html> in step with the time, the sun, the weather
 * and light/dark (once a minute, and whenever one of them changes). Draws nothing
 * itself; only active while that design is chosen on this device.
 */
export function SkyController() {
  const [device] = useDevicePrefs();
  const active = device.design === "sky";
  return active ? <Sky /> : <Clear />;
}

/** Another design: the sky's variables go away (they would override its colours). */
function Clear() {
  useEffect(() => {
    const style = document.documentElement.style;
    for (const name of SKY_VARS) style.removeProperty(name);
  }, []);
  return null;
}

function Sky() {
  const now = useNow("minute");
  const { settings } = useSettings();
  const forecast = useForecast(settings.location).data;
  const home = usePathname() === "/";
  const dark = useDarkClass();
  const layout = useHomeLayout(home);

  useEffect(() => {
    if (!now) return;
    const today = forecast?.daily.find((d) => d.day === toDayKey(now));
    const stored = readSunTimes();
    const sunrise = today?.sunrise ? isoToMinutes(today.sunrise) : (stored?.sunrise ?? 420);
    const sunset = today?.sunset ? isoToMinutes(today.sunset) : (stored?.sunset ?? 1140);
    // An old forecast (e.g. after a night offline) says nothing about the weather now.
    const fresh = forecast && Date.now() - forecast.fetchedAt < 3 * 60 * 60_000;
    const sky = computeSky({
      minutes: now.getHours() * 60 + now.getMinutes(),
      sunrise,
      sunset,
      weather: skyWeather(fresh ? forecast.current.code : null),
      temperature: fresh ? forecast.current.temperature : null,
      dark,
      layout,
    });
    const root = document.documentElement;
    for (const [name, value] of Object.entries(sky.vars)) root.style.setProperty(name, value);
    root.dataset.sky = sky.weather;
    // For the next start: painted before the first frame (see applyDeviceState).
    try {
      localStorage.setItem(SKY_STORAGE_KEY, JSON.stringify({ ...sky.vars, weather: sky.weather }));
    } catch {
      // ignore
    }
  }, [now, forecast, dark, layout]);

  useEffect(
    () => () => {
      delete document.documentElement.dataset.sky;
    },
    [],
  );

  return null;
}

/** Follows the light/dark class on <html> (the "auto" theme switches at sunset). */
function useDarkClass() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.classList.contains("dark"));
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

/**
 * On the home screen the clock is the window to the sky: the horizon lies just below
 * the date, the sun and moon travel where no text is – right of the clock on wide
 * screens (in the clock's column), over the right half of the sky on phones.
 */
function useHomeLayout(home: boolean): SkyLayout {
  const [layout, setLayout] = useState<SkyLayout>(CALM_LAYOUT);
  useEffect(() => {
    if (!home) return;
    let frame = 0;
    const measure = () => {
      const hero = document.querySelector<HTMLElement>("[data-sky-window]");
      const time = hero?.querySelector("time");
      if (!hero || !time) return setLayout(CALM_LAYOUT);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const box = hero.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(time);
      const text = range.getBoundingClientRect();
      const y = window.scrollY;
      const horizon = Math.min(45, Math.max(14, ((box.bottom + y + 14) / vh) * 100));
      const top = Math.max(4, ((box.top + y + 10) / vh) * 100);
      const column = box.right < vw * 0.6;
      let next: SkyLayout;
      if (column) {
        const width = Math.min(100, ((box.right + 24) / vw) * 100);
        const x1 = (box.right / vw) * 100 - 1.5;
        const x0 = Math.min(x1 - 4, (text.right / vw) * 100 + 2.5);
        next = { scene: "full", horizon, top, x0, x1, width };
      } else {
        const x0 = Math.max(52, (text.right / vw) * 100 + 8);
        next = { scene: "full", horizon, top: top + 2, x0, x1: Math.max(x0 + 10, 93), width: 100 };
      }
      setLayout((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    schedule();
    // The clock appears after hydration and changes size with the time and the text size.
    const observer = new ResizeObserver(schedule);
    const watch = () => {
      const hero = document.querySelector("[data-sky-window]");
      if (hero) observer.observe(hero);
    };
    watch();
    const retry = window.setTimeout(() => {
      watch();
      schedule();
    }, 500);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(retry);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [home]);
  return home ? layout : CALM_LAYOUT;
}
