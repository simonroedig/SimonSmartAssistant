import { Droplets, Moon, Sunrise } from "lucide-react";
import type { DayKey } from "@/lib/date";
import { hourSleep, type SleepSchedule } from "@/lib/sleep";
import { formatMinutes } from "@/lib/time";
import { TODAY_RING, TODAY_TEXT } from "@/lib/tones";
import { cn } from "@/lib/utils";
import type { HourlyPoint } from "@/lib/weather/open-meteo";
import { WeatherIcon } from "./weather-icon";

/** Sleep shading and wake/bed markers for one forecast hour. */
export function sleepForHour(schedule: SleepSchedule | undefined, h: HourlyPoint) {
  return schedule ? hourSleep(schedule, h.time.slice(0, 10) as DayKey, h.hour) : null;
}

/** Hour label with a sunrise icon at wake-up and a moon at bedtime. */
export function HourLabel({
  h,
  sleep,
  isNow,
  className,
}: {
  h: HourlyPoint;
  sleep: ReturnType<typeof sleepForHour>;
  isNow: boolean;
  className?: string;
}) {
  const marker = sleep?.wake !== undefined ? "wake" : sleep?.bed !== undefined ? "bed" : null;
  return (
    <span
      className={cn("flex items-center gap-0.5 text-xs font-medium tabular", className)}
      title={
        marker === "wake"
          ? `Wake-up ${formatMinutes(sleep!.wake!)}`
          : marker === "bed"
            ? `Bedtime ${formatMinutes(sleep!.bed!)}`
            : undefined
      }
    >
      {marker === "wake" && <Sunrise className="size-3 text-amber-500 dark:text-amber-300" />}
      {marker === "bed" && <Moon className="size-3 text-indigo-500 dark:text-indigo-300" />}
      {isNow ? "Now" : `${String(h.hour).padStart(2, "0")}:00`}
    </span>
  );
}

export function HourlyStrip({
  hours,
  sleepSchedule,
  className,
  firstIsNow = true,
}: {
  hours: HourlyPoint[];
  /** Shades the hours you are asleep and marks wake-up and bedtime. */
  sleepSchedule?: SleepSchedule;
  className?: string;
  firstIsNow?: boolean;
}) {
  // The rain line only takes room when some hour has a real chance of rain.
  const anyRain = hours.some((h) => h.precipitationProbability >= 20);
  return (
    // Never squeezed by a short card (it would scroll up and down): the daily list gives way.
    <div
      className={cn("-mx-1 no-scrollbar flex shrink-0 snap-x scroll-px-4 gap-1 overflow-x-auto px-1 py-0.5", className)}
    >
      {hours.map((h, i) => {
        const now = firstIsNow && i === 0;
        const sleep = sleepForHour(sleepSchedule, h);
        return (
          <div
            key={h.time}
            className={cn(
              "flex w-[3.6rem] shrink-0 snap-start flex-col items-center gap-1 rounded-2xl py-2.5",
              now && TODAY_RING,
              !now && sleep?.asleep && "sleep-shade",
            )}
          >
            <HourLabel h={h} sleep={sleep} isNow={now} className={now ? TODAY_TEXT : "text-muted"} />
            <WeatherIcon
              code={h.code}
              isDay={h.isDay}
              className={cn("size-10", sleep?.asleep && !now && "opacity-60")}
            />
            <span
              className={cn(
                "font-semibold tabular",
                now ? "text-[1.05rem]" : "text-[0.95rem]",
                sleep?.asleep && !now && "text-muted",
              )}
            >
              {Math.round(h.temperature)}°
            </span>
            {anyRain && (
              <span
                className={cn(
                  "flex h-4 items-center gap-0.5 text-[0.68rem] font-semibold text-sky-500 tabular dark:text-sky-300",
                  h.precipitationProbability < 20 && "invisible",
                )}
              >
                <Droplets className="size-3" />
                {h.precipitationProbability}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
