"use client";

import { CloudSun, MapPin, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { useSettings, useSettingsRow, useUpdateSettings } from "@/data/settings";
import { useForecast } from "@/data/weather";
import { useNow } from "@/hooks/use-now";
import { toDayKey } from "@/lib/date";
import { weatherInfo } from "@/lib/weather/codes";
import { upcomingHours } from "@/lib/weather/open-meteo";
import { cn } from "@/lib/utils";
import { DailyList } from "./daily-list";
import { HourlyStrip } from "./hourly-strip";
import { LocationSearch } from "./location-search";
import { WeatherIcon } from "./weather-icon";

export function WeatherCard({ className, days = 7 }: { className?: string; days?: number }) {
  const router = useRouter();
  const { settings, isLoading: settingsLoading } = useSettings();
  const settingsRow = useSettingsRow();
  const updateSettings = useUpdateSettings();
  const forecast = useForecast(settings.location);
  const now = useNow("minute");

  const header = (
    <CardHeader
      icon={<CloudSun />}
      title="Weather"
      tone="sky"
      href="/weather"
      actions={
        settings.location && (
          <span className="flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-3.5" />
            {settings.location.name}
          </span>
        )
      }
    />
  );

  if (!settingsLoading && !settings.location) {
    return (
      <Card className={className}>
        {header}
        <div className="px-5 pb-5">
          <p className="mb-3 text-sm text-muted">Where are you? Pick your city to get the forecast.</p>
          <LocationSearch
            onSelect={(location) => settingsRow.data && updateSettings.mutate({ current: settingsRow.data, location })}
          />
        </div>
      </Card>
    );
  }

  const data = forecast.data;
  if (!data || !now) {
    return (
      <Card className={className}>
        {header}
        <div className="flex flex-col gap-4 px-5 pb-5">
          {forecast.isError ? (
            <button
              type="button"
              onClick={() => forecast.refetch()}
              className="flex items-center gap-2 text-sm text-muted"
            >
              <RefreshCw className="size-4" /> Weather unavailable – tap to retry
            </button>
          ) : (
            <>
              <div className="skeleton h-24 w-full" />
              <div className="skeleton h-28 w-full" />
              <div className="skeleton h-48 w-full" />
            </>
          )}
        </div>
      </Card>
    );
  }

  const today = toDayKey(now);
  const todayDaily = data.daily.find((d) => d.day === today) ?? data.daily[0];
  const info = weatherInfo(data.current.code, data.current.isDay);
  const hours = upcomingHours(data, 18, now.getTime());

  return (
    <Card className={cn("overflow-hidden", className)}>
      {header}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-3">
        <div className="flex items-center gap-3 px-5">
          <WeatherIcon code={data.current.code} isDay={data.current.isDay} className="-my-2 -ml-2 size-24" />
          <div className="min-w-0">
            <div className="ui-display text-[3.6rem] leading-none font-light tracking-tight tabular">
              {Math.round(data.current.temperature)}°
            </div>
            <div className="mt-1 truncate text-sm text-muted">
              {info.label} · feels {Math.round(data.current.feelsLike)}°
            </div>
          </div>
          {todayDaily && (
            <div className="ml-auto shrink-0 text-right text-sm text-muted tabular">
              <div>
                <span className="font-semibold text-fg">{Math.round(todayDaily.max)}°</span> /{" "}
                {Math.round(todayDaily.min)}°
              </div>
              <div>{todayDaily.precipitationProbability}% rain</div>
            </div>
          )}
        </div>
        <HourlyStrip hours={hours} sleepSchedule={settings.sleepSchedule} className="mx-0 mt-3 px-4" />
        <div className="mx-5 my-2 h-px bg-line" />
        <DailyList
          className="px-3"
          dense
          days={data.daily.slice(0, days)}
          today={today}
          currentTemp={data.current.temperature}
          onSelect={(day) => router.push(`/weather?day=${day}`)}
        />
      </div>
    </Card>
  );
}
