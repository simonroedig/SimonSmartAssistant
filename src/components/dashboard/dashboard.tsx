"use client";

import { Settings2 } from "lucide-react";
import { NotesBoard } from "@/components/notes/notes-board";
import { TodayCard } from "@/components/planner/today-card";
import { AppLink } from "@/components/shell/app-link";
import { ShoppingList } from "@/components/shopping/shopping-list";
import { TodoList } from "@/components/todos/todo-list";
import { WeatherCard } from "@/components/weather/weather-card";
import { WeatherSummary } from "@/components/weather/weather-summary";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useToday } from "@/hooks/use-today";
import { LauncherUpdateBanner, WebSearchBar } from "@/components/launcher/launcher-widgets";
import { ClockHero } from "./clock-hero";

/**
 * Home screen. On the wall display (≥1280px) everything fits on one screen in
 * three columns; tablets get two columns, phones a scrollable stack.
 */
export function Dashboard() {
  const today = useToday();
  const wide = useMediaQuery("(min-width: 1280px)");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 p-4 pt-[calc(var(--safe-top)+1rem)] md:grid-cols-2 md:p-(--gutter) md:pl-0 xl:h-dvh xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)_minmax(0,0.95fr)] xl:overflow-hidden">
      {/* Column 1: clock + weather */}
      <div className="flex min-h-0 flex-col gap-4">
        <div className="flex items-start gap-3 px-2 pt-2 md:pt-1">
          <ClockHero className="flex-1" compact={!wide} />
          <AppLink
            href="/settings"
            aria-label="Settings"
            className="-mt-1 -mr-1.5 grid size-12 shrink-0 place-items-center rounded-2xl text-slate-500 transition-colors hover:bg-surface-hover active:bg-surface-hover md:hidden dark:text-slate-300"
          >
            <Settings2 className="size-[1.6rem]" strokeWidth={1.9} />
          </AppLink>
        </div>
        {/* Launcher app on the phone: web search and app updates right on the home screen. */}
        <WebSearchBar />
        <LauncherUpdateBanner />
        <WeatherSummary className="md:hidden" />
        <WeatherCard className="hidden min-h-0 flex-1 md:flex" />
      </div>

      {/* Column 2: the day plan */}
      {today ? (
        <TodayCard today={today} fit={wide} className="md:row-span-1 xl:h-full xl:min-h-0" />
      ) : (
        <div className="skeleton min-h-[24rem] rounded-(--radius-card)" />
      )}

      {/* Column 3: lists and notes */}
      <div className="flex min-h-0 flex-col gap-4 md:col-span-2 md:grid md:grid-cols-2 xl:col-span-1 xl:flex">
        {/* Stacked (phone, tablet): the first few entries and a link to the rest. On the
            wall display every card has a fixed height and scrolls inside. */}
        <ShoppingList variant="card" limit={wide ? undefined : 5} className="min-h-0 xl:flex-1" />
        <TodoList variant="card" limit={wide ? undefined : 5} className="min-h-0 xl:flex-1" />
        <NotesBoard variant="card" limit={wide ? undefined : 4} className="min-h-0 md:col-span-2 xl:flex-1" />
      </div>
    </div>
  );
}
