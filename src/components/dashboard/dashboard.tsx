"use client";

import { Settings2 } from "lucide-react";
import Link from "next/link";
import { TodayCard } from "@/components/planner/today-card";
import { ShoppingList } from "@/components/shopping/shopping-list";
import { TodoList } from "@/components/todos/todo-list";
import { WeatherIcon } from "@/components/weather/weather-icon";
import { WeatherCard } from "@/components/weather/weather-card";
import { useSettings } from "@/data/settings";
import { useForecast } from "@/data/weather";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useToday } from "@/hooks/use-today";
import { ClockHero } from "./clock-hero";

function MiniWeather() {
  const { settings } = useSettings();
  const forecast = useForecast(settings.location);
  const current = forecast.data?.current;
  if (!current) return null;
  return (
    <Link href="/weather" className="flex shrink-0 items-center gap-1 rounded-2xl pr-2">
      <WeatherIcon code={current.code} isDay={current.isDay} className="size-11" />
      <span className="text-2xl font-light tabular">{Math.round(current.temperature)}°</span>
    </Link>
  );
}

/**
 * Home screen. On the wall display (≥1280px) everything fits on one screen in
 * three columns; tablets get two columns, phones a scrollable stack.
 */
export function Dashboard() {
  const today = useToday();
  const wide = useMediaQuery("(min-width: 1280px)");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 p-4 pt-[max(1rem,env(safe-area-inset-top))] md:grid-cols-2 md:p-6 xl:h-dvh xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)_minmax(0,0.95fr)] xl:overflow-hidden">
      {/* Column 1: clock + weather */}
      <div className="flex min-h-0 flex-col gap-4">
        <div className="flex items-start gap-3 px-2 pt-2 md:pt-1">
          <ClockHero className="flex-1" compact={!wide} />
          <div className="flex items-center gap-1 md:hidden">
            <MiniWeather />
          </div>
          <Link
            href="/settings"
            aria-label="Settings"
            className="grid size-11 shrink-0 place-items-center rounded-2xl text-faint transition-colors hover:bg-surface-hover hover:text-fg md:hidden"
          >
            <Settings2 className="size-5" />
          </Link>
        </div>
        <WeatherCard className="hidden min-h-0 flex-1 md:flex" />
      </div>

      {/* Column 2: today's plan */}
      {today ? (
        <TodayCard today={today} fit={wide} className="min-h-[28rem] md:row-span-1 xl:h-full xl:min-h-0" />
      ) : (
        <div className="skeleton min-h-[28rem] rounded-[1.75rem]" />
      )}

      {/* Column 3: lists */}
      <div className="flex min-h-0 flex-col gap-4 md:col-span-2 md:grid md:grid-cols-2 xl:col-span-1 xl:flex">
        <ShoppingList variant="card" className="min-h-0 xl:flex-1" />
        <TodoList variant="card" className="min-h-0 xl:flex-1" />
      </div>

      {/* Phones: weather at the end of the stack */}
      <WeatherCard className="md:hidden" />
    </div>
  );
}
