"use client";

import {
  Droplets,
  Flower2,
  Gauge,
  MapPin,
  Navigation,
  RefreshCw,
  Sun,
  Sunrise,
  Sunset,
  ThermometerSun,
  Umbrella,
  Wind,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { useSettings, useSettingsRow, useUpdateSettings } from "@/data/settings";
import { useAirQuality, useForecast } from "@/data/weather";
import { useNow } from "@/hooks/use-now";
import { formatDayMonth, formatWeekday, fromDayKey, isDayKey, toDayKey } from "@/lib/date";
import { aqiLabel, uvLabel, weatherInfo, windDirectionLabel } from "@/lib/weather/codes";
import { awakeWindow } from "@/lib/sleep";
import { formatLocationLong, hoursOfDay, locationNowIso, pollenLevel } from "@/lib/weather/open-meteo";
import { TODAY_COLOR } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { DailyList } from "./daily-list";
import { HourlyChart } from "./hourly-chart";
import { LocationSearch } from "./location-search";
import { WeatherIcon } from "./weather-icon";

function Tile({
  icon,
  label,
  value,
  hint,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-3xl p-4 well", className)}>
      <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase [&_svg]:size-3.5">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular">{value}</div>
      {hint && <div className="mt-0.5 text-sm text-muted">{hint}</div>}
    </div>
  );
}

export function WeatherView({ initialDay }: { initialDay?: string }) {
  const router = useRouter();
  const { settings, isLoading } = useSettings();
  const settingsRow = useSettingsRow();
  const updateSettings = useUpdateSettings();
  const forecast = useForecast(settings.location);
  const air = useAirQuality(settings.location);
  const now = useNow("minute");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<string | undefined>(isDayKey(initialDay) ? initialDay : undefined);

  const changeLocation = (
    <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
      <MapPin /> {settings.location ? settings.location.name : "Set location"}
    </Button>
  );

  const picker = (
    <Sheet open={pickerOpen} onOpenChange={setPickerOpen} title="Weather location" size="sm">
      <LocationSearch
        autoFocus
        onSelect={(location) => {
          if (settingsRow.data) updateSettings.mutate({ current: settingsRow.data, location });
          setPickerOpen(false);
        }}
      />
    </Sheet>
  );

  if (!isLoading && !settings.location) {
    return (
      <>
        <PageHeader title="Weather" />
        <PageBody>
          <Card className="max-w-xl p-6">
            <h2 className="text-lg font-semibold">Pick your city</h2>
            <p className="mt-1 mb-4 text-sm text-muted">
              The forecast comes from Open-Meteo – free and without tracking.
            </p>
            <LocationSearch
              onSelect={(location) =>
                settingsRow.data && updateSettings.mutate({ current: settingsRow.data, location })
              }
            />
          </Card>
        </PageBody>
      </>
    );
  }

  const data = forecast.data;
  if (!data || !now) {
    return (
      <>
        <PageHeader title="Weather" actions={changeLocation} />
        <PageBody className="grid gap-4 lg:grid-cols-2">
          {forecast.isError ? (
            <Card className="p-6">
              <Button variant="secondary" onClick={() => forecast.refetch()}>
                <RefreshCw /> Retry
              </Button>
            </Card>
          ) : (
            <>
              <div className="skeleton h-80" />
              <div className="skeleton h-80" />
            </>
          )}
        </PageBody>
        {picker}
      </>
    );
  }

  const today = toDayKey(now);
  const day = selected && data.daily.some((d) => d.day === selected) ? selected : today;
  const dayData = data.daily.find((d) => d.day === day) ?? data.daily[0];
  const todayData = data.daily.find((d) => d.day === today) ?? data.daily[0];
  const info = weatherInfo(data.current.code, data.current.isDay);
  const nowHour = `${locationNowIso(data, now.getTime()).slice(0, 13)}:00`;
  const hours = hoursOfDay(data, day);
  const wakeHour = Math.floor(awakeWindow(settings.sleepSchedule, day)[0] / 60);
  const focusHour = day === today ? Number(nowHour.slice(11, 13)) : wakeHour;

  return (
    <>
      <PageHeader
        title="Weather"
        subtitle={settings.location ? formatLocationLong(settings.location) : undefined}
        actions={changeLocation}
      />
      <PageBody className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Forecast first (on phones too), then the details of right now. */}
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="p-5">
            <h2 className="mb-1 text-[0.95rem] font-semibold">
              {day === today ? <span className={TODAY_COLOR}>Today</span> : formatWeekday(fromDayKey(day))},{" "}
              {formatDayMonth(fromDayKey(day))}
            </h2>
            <p className="mb-4 text-sm text-muted">
              {weatherInfo(dayData.code).label} · {Math.round(dayData.min)}° to {Math.round(dayData.max)}° ·{" "}
              {dayData.precipitationProbability}% rain
            </p>
            <HourlyChart
              hours={hours}
              focusHour={focusHour}
              nowTime={day === today ? nowHour : undefined}
              sleepSchedule={settings.sleepSchedule}
            />
          </Card>
          <Card className="p-3">
            <h2 className="px-2 pt-2 pb-2 text-[0.95rem] font-semibold">Next 7 days</h2>
            <DailyList
              days={data.daily.slice(0, 7)}
              today={today}
              selected={day}
              currentTemp={data.current.temperature}
              onSelect={(d) => {
                setSelected(d);
                router.replace(d === today ? "/weather" : `/weather?day=${d}`, { scroll: false });
              }}
            />
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card className="overflow-hidden p-6">
            <div className="flex items-center gap-4">
              <WeatherIcon code={data.current.code} isDay={data.current.isDay} className="-m-3 size-32" />
              <div>
                <div className="ui-display text-7xl leading-none font-extralight tracking-tight tabular">
                  {Math.round(data.current.temperature)}°
                </div>
                <div className="mt-2 text-lg font-medium">{info.label}</div>
                <div className="text-muted tabular">
                  H {Math.round(todayData.max)}° · L {Math.round(todayData.min)}°
                </div>
              </div>
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tile
              icon={<ThermometerSun />}
              label="Feels like"
              value={`${Math.round(data.current.feelsLike)}°`}
              hint={
                Math.abs(data.current.feelsLike - data.current.temperature) < 2
                  ? "Similar to actual"
                  : data.current.feelsLike < data.current.temperature
                    ? "Wind makes it cooler"
                    : "Feels warmer"
              }
            />
            <Tile icon={<Droplets />} label="Humidity" value={`${Math.round(data.current.humidity)}%`} />
            <Tile
              icon={<Wind />}
              label="Wind"
              value={
                <span className="flex items-center gap-2">
                  {Math.round(data.current.windSpeed)}
                  <span className="text-base font-medium text-muted">km/h</span>
                  <Navigation
                    className="size-4 text-muted"
                    style={{ transform: `rotate(${data.current.windDirection + 180}deg)` }}
                  />
                </span>
              }
              hint={`${windDirectionLabel(data.current.windDirection)} · gusts ${Math.round(data.current.windGusts)}`}
            />
            <Tile
              icon={<Sun />}
              label="UV index"
              value={Math.round(todayData.uvIndexMax)}
              hint={uvLabel(todayData.uvIndexMax)}
            />
            <Tile
              icon={<Sunrise />}
              label="Sunrise"
              value={todayData.sunrise.slice(11, 16)}
              hint={
                <span className="flex items-center gap-1">
                  <Sunset className="size-3.5" /> {todayData.sunset.slice(11, 16)}
                </span>
              }
            />
            <Tile
              icon={<Umbrella />}
              label="Rain today"
              value={`${todayData.precipitationSum.toFixed(1).replace(".", ",")} mm`}
              hint={`${todayData.precipitationProbability}% chance`}
            />
            {air.data?.europeanAqi !== null && air.data?.europeanAqi !== undefined && (
              <Tile
                icon={<Gauge />}
                label="Air quality"
                value={Math.round(air.data.europeanAqi)}
                hint={aqiLabel(air.data.europeanAqi)}
              />
            )}
            {air.data && air.data.pollen.length > 0 && (
              <Tile
                icon={<Flower2 />}
                label="Pollen"
                value={air.data.pollen[0].name}
                hint={`${pollenLevel(air.data.pollen[0].value)}${
                  air.data.pollen[1] ? ` · ${air.data.pollen[1].name} ${pollenLevel(air.data.pollen[1].value)}` : ""
                }`}
                className="col-span-2 sm:col-span-1"
              />
            )}
          </div>
        </div>
      </PageBody>
      {picker}
    </>
  );
}
