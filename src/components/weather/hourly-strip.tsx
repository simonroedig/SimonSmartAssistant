import { Droplets } from "lucide-react";
import type { HourlyPoint } from "@/lib/weather/open-meteo";
import { cn } from "@/lib/utils";
import { WeatherIcon } from "./weather-icon";

export function HourlyStrip({
  hours,
  className,
  firstIsNow = true,
}: {
  hours: HourlyPoint[];
  className?: string;
  firstIsNow?: boolean;
}) {
  return (
    <div className={cn("-mx-1 no-scrollbar flex snap-x gap-1 overflow-x-auto px-1", className)}>
      {hours.map((h, i) => {
        const now = firstIsNow && i === 0;
        return (
          <div
            key={h.time}
            className={cn(
              "flex w-[3.6rem] shrink-0 snap-start flex-col items-center gap-1 rounded-2xl py-2.5",
              now && "bg-surface-hover ring-1 ring-line",
            )}
          >
            <span className={cn("text-xs font-medium tabular", now ? "text-fg" : "text-muted")}>
              {now ? "Now" : `${String(h.hour).padStart(2, "0")}:00`}
            </span>
            <WeatherIcon code={h.code} isDay={h.isDay} className="size-10" />
            <span className="text-[0.95rem] font-semibold tabular">{Math.round(h.temperature)}°</span>
            <span
              className={cn(
                "flex h-4 items-center gap-0.5 text-[0.68rem] font-semibold text-sky-500 tabular dark:text-sky-300",
                h.precipitationProbability < 20 && "invisible",
              )}
            >
              <Droplets className="size-3" />
              {h.precipitationProbability}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
