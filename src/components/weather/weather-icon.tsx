import { weatherInfo } from "@/lib/weather/codes";
import { cn } from "@/lib/utils";

export function WeatherIcon({
  code,
  isDay = true,
  className,
  name,
}: {
  code?: number;
  isDay?: boolean;
  className?: string;
  /** Use a specific icon file instead of a weather code (e.g. "sunrise"). */
  name?: string;
}) {
  const info = code === undefined ? { icon: name ?? "not-available", label: name ?? "" } : weatherInfo(code, isDay);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/weather/${name ?? info.icon}.svg`}
      alt={code === undefined ? "" : info.label}
      draggable={false}
      className={cn("pointer-events-none shrink-0 select-none", className)}
    />
  );
}
