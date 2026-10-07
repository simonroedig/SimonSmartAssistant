"use client";

import { MapPin } from "lucide-react";
import { AppLink } from "@/components/shell/app-link";
import { Card } from "@/components/ui/card";
import { useSettings } from "@/data/settings";
import { useForecast } from "@/data/weather";
import { useNow } from "@/hooks/use-now";
import { formatWeekdayShort, fromDayKey, toDayKey } from "@/lib/date";
import { cn } from "@/lib/utils";
import { weatherInfo } from "@/lib/weather/codes";
import { WeatherIcon } from "./weather-icon";

/**
 * Compact weather for the phone home screen: now, today's range and the next
 * days at a glance. Tapping it (or a day) opens the weather page.
 */
export function WeatherSummary({ className }: { className?: string }) {
  const { settings, isLoading: settingsLoading } = useSettings();
  const forecast = useForecast(settings.location);
  const now = useNow("minute");
  const data = forecast.data;

  if (!settingsLoading && !settings.location) {
    return (
      <Card className={cn("p-4", className)}>
        <AppLink href="/settings" className="text-sm text-muted">
          Pick your city in <span className="font-semibold text-sky-600 dark:text-sky-300">Settings</span> to see the
          weather.
        </AppLink>
      </Card>
    );
  }

  if (!data || !now) {
    return <div className={cn("skeleton h-[9.5rem] rounded-[1.75rem]", className)} aria-hidden="true" />;
  }

  const today = toDayKey(now);
  const todayDaily = data.daily.find((d) => d.day === today) ?? data.daily[0];
  const nextDays = data.daily.filter((d) => d.day >= today).slice(0, 5);
  const info = weatherInfo(data.current.code, data.current.isDay);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <AppLink href="/weather" className="flex items-center gap-2 px-4 pt-3" aria-label="Open the weather">
        <WeatherIcon code={data.current.code} isDay={data.current.isDay} className="-my-1 -ml-1 size-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[2.6rem] leading-none font-light tracking-tight tabular">
              {Math.round(data.current.temperature)}°
            </span>
            <span className="truncate text-sm font-medium">{info.label}</span>
          </div>
          {todayDaily && (
            <div className="mt-1 truncate text-xs text-muted tabular">
              H {Math.round(todayDaily.max)}° · L {Math.round(todayDaily.min)}° · {todayDaily.precipitationProbability}%
              rain
            </div>
          )}
        </div>
        {settings.location && (
          <span className="flex shrink-0 items-center gap-1 self-start pt-1 text-xs text-muted">
            <MapPin className="size-3" />
            {settings.location.name}
          </span>
        )}
      </AppLink>
      <ul className="grid grid-cols-5 gap-1 px-2 pt-2 pb-2.5">
        {nextDays.map((d) => (
          <li key={d.day}>
            <AppLink
              href={d.day === today ? "/weather" : `/weather?day=${d.day}`}
              className={cn(
                "flex flex-col items-center rounded-2xl py-1.5 transition-colors active:bg-surface-hover",
                d.day === today && "bg-sky-500/14 ring-2 ring-sky-500/50 ring-inset dark:ring-sky-300/50",
              )}
            >
              <span
                className={cn(
                  "text-[0.7rem] font-semibold",
                  d.day === today ? "font-bold text-sky-700 dark:text-sky-200" : "text-muted",
                )}
              >
                {d.day === today ? "Today" : formatWeekdayShort(fromDayKey(d.day))}
              </span>
              <WeatherIcon code={d.code} isDay className="size-9" />
              <span className="text-xs tabular">
                <span className="font-semibold">{Math.round(d.max)}°</span>{" "}
                <span className="text-muted">{Math.round(d.min)}°</span>
              </span>
            </AppLink>
          </li>
        ))}
      </ul>
    </Card>
  );
}
