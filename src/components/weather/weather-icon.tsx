"use client";

import { useStill } from "@/components/kiosk/still-mode";
import { MOON_LABEL, moonIcon } from "@/lib/moon";
import { weatherInfo } from "@/lib/weather/codes";
import { cn } from "@/lib/utils";

export function WeatherIcon({
  code,
  isDay = true,
  className,
  name,
  at,
}: {
  code?: number;
  isDay?: boolean;
  className?: string;
  /** Use a specific icon file instead of a weather code (e.g. "sunrise"). */
  name?: string;
  /** When (local ISO time): a clear night shows the moon as it is then – crescent, half or full. */
  at?: string;
}) {
  let info = code === undefined ? { icon: name ?? "not-available", label: name ?? "" } : weatherInfo(code, isDay);
  if (code === 0 && !isDay && !name) {
    const moon = moonIcon(at ? new Date(at) : new Date());
    info = { icon: moon, label: `${info.label} · ${MOON_LABEL[moon]}` };
  }
  // The wall display at rest: the same icon without its animation (scripts/still-weather-icons.mjs).
  const still = useStill();
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/weather/${still ? "still/" : ""}${name ?? info.icon}.svg`}
      alt={code === undefined ? "" : info.label}
      draggable={false}
      className={cn("pointer-events-none shrink-0 select-none", className)}
    />
  );
}
