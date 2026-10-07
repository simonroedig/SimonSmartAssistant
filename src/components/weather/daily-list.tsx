import { Droplets } from "lucide-react";
import { formatWeekdayShort, fromDayKey } from "@/lib/date";
import type { DailyPoint } from "@/lib/weather/open-meteo";
import { cn } from "@/lib/utils";
import { TemperatureBar } from "./temperature-bar";
import { WeatherIcon } from "./weather-icon";

/** Same highlight as the "Now" hour. */
const TODAY_STYLE = "bg-sky-500/14 ring-2 ring-sky-500/50 ring-inset dark:ring-sky-300/50";

export function DailyList({
  days,
  today,
  selected,
  onSelect,
  currentTemp,
  dense = false,
  className,
}: {
  days: DailyPoint[];
  today: string;
  selected?: string;
  onSelect?: (day: string) => void;
  currentTemp?: number;
  dense?: boolean;
  className?: string;
}) {
  if (days.length === 0) return null;
  const weekMin = Math.min(...days.map((d) => d.min));
  const weekMax = Math.max(...days.map((d) => d.max));

  return (
    <ul className={cn("flex flex-col", className)}>
      {days.map((d) => {
        const isToday = d.day === today;
        const isSelected = selected === d.day;
        const content = (
          <>
            <span
              className={cn(
                "w-12 text-left text-[0.92rem] font-semibold",
                isToday ? "font-bold text-sky-700 dark:text-sky-200" : "text-muted",
              )}
            >
              {isToday ? "Today" : formatWeekdayShort(fromDayKey(d.day))}
            </span>
            <WeatherIcon code={d.code} isDay className={dense ? "size-8" : "size-10"} />
            <span
              className={cn(
                "flex w-12 items-center gap-0.5 text-xs font-semibold text-sky-500 tabular dark:text-sky-300",
                d.precipitationProbability < 20 && "invisible",
              )}
            >
              <Droplets className="size-3" />
              {d.precipitationProbability}%
            </span>
            <span className="w-9 text-right text-[0.92rem] text-muted tabular">{Math.round(d.min)}°</span>
            <TemperatureBar
              className="mx-2 flex-1"
              min={d.min}
              max={d.max}
              weekMin={weekMin}
              weekMax={weekMax}
              current={isToday ? currentTemp : undefined}
            />
            <span className="w-9 text-[0.92rem] font-semibold tabular">{Math.round(d.max)}°</span>
          </>
        );
        return (
          <li key={d.day}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(d.day)}
                aria-pressed={isSelected}
                className={cn(
                  "flex w-full items-center gap-2 rounded-2xl px-2 transition-colors",
                  dense ? "h-12" : "h-14",
                  isToday
                    ? cn(TODAY_STYLE, isSelected && "ring-sky-500/80")
                    : isSelected
                      ? "bg-surface-hover ring-1 ring-line"
                      : "hover:bg-surface-hover/60",
                )}
              >
                {content}
              </button>
            ) : (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-2xl px-2",
                  dense ? "h-12" : "h-14",
                  isToday && TODAY_STYLE,
                )}
              >
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
