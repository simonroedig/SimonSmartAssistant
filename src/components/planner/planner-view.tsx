"use client";

import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Eraser,
  ListTodo,
  MoreHorizontal,
  Plus,
  Star,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { sortOpenTodos, useTodos } from "@/data/todos";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useNow } from "@/hooks/use-now";
import {
  addDays,
  type DayKey,
  dueLabel,
  formatDayMonthYear,
  formatLongDate,
  formatWeekday,
  fromDayKey,
  isoWeek,
  relativeDayLabel,
  toDayKey,
} from "@/lib/date";
import { formatDuration, minutesOfDay } from "@/lib/time";
import { cn } from "@/lib/utils";
import { BlockEditor } from "./block-editor";
import { DayTimeline } from "./day-timeline";
import { FocusInput } from "./focus-input";
import { NowNext } from "./now-next";
import { usePlanner } from "./use-planner";
import { WeekStrip } from "./week-strip";

function MenuItem({
  icon,
  label,
  onSelect,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onSelect: () => void;
  danger?: boolean;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-[0.92rem] font-medium outline-none data-[highlighted]:bg-surface-hover [&_svg]:size-4",
        danger ? "text-danger" : "text-fg",
      )}
    >
      {icon}
      {label}
    </DropdownMenu.Item>
  );
}

export function PlannerView({ day }: { day: DayKey }) {
  const router = useRouter();
  const now = useNow("minute");
  const today = now ? toDayKey(now) : null;
  const planner = usePlanner(day);
  const todos = useTodos();
  const isWide = useMediaQuery("(min-width: 1024px)");
  const isPhone = useMediaQuery("(max-width: 767px)");

  const go = (target: DayKey) =>
    router.replace(target === today ? "/planner" : `/planner?day=${target}`, { scroll: false });

  const openTodos = useMemo(() => sortOpenTodos(todos.data ?? []).slice(0, 12), [todos.data]);
  const isToday = day === today;
  const hourHeight = isPhone ? 56 : 64;
  const plannedMinutes = planner.dayBlocks.reduce((sum, b) => sum + (b.end_min - b.start_min), 0);
  const doneCount = planner.dayBlocks.filter((b) => b.done).length;
  const awakeMinutes = planner.awake[1] - planner.awake[0];
  const scrollTarget = isToday && now ? Math.max(minutesOfDay(now) - 60, 0) : planner.awake[0] - 30;

  const date = fromDayKey(day);
  const relative = today ? relativeDayLabel(day, today) : "";
  const isRelative = ["Today", "Tomorrow", "Yesterday"].includes(relative);
  const title = isRelative ? relative : formatWeekday(date);
  const subtitle = `${isRelative ? formatLongDate(date) : formatDayMonthYear(date)} · KW ${isoWeek(day)}`;

  const menu = (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="secondary" size="icon" aria-label="More actions">
          <MoreHorizontal />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-60 rounded-2xl p-1.5 glass-strong">
          <MenuItem
            icon={<ClipboardCopy />}
            label="Copy plan from yesterday"
            onSelect={() => {
              const yesterday = addDays(day, -1);
              const source = planner.weekBlocks.filter((b) => b.day === yesterday);
              if (source.length > 0) planner.copyTo(source, day);
              else go(yesterday);
            }}
          />
          <MenuItem
            icon={<CalendarPlus />}
            label="Copy plan to tomorrow"
            onSelect={() => planner.copyTo(planner.dayBlocks, addDays(day, 1))}
          />
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <MenuItem icon={<Eraser />} label="Clear this day" danger onSelect={planner.clearDay} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );

  return (
    <div className="flex h-[calc(100dvh-6.5rem-env(safe-area-inset-bottom))] flex-col md:h-dvh">
      <PageHeader
        title={title || " "}
        subtitle={subtitle}
        actions={
          <>
            {!isToday && today && (
              <Button variant="soft" size="sm" onClick={() => go(today)}>
                Today
              </Button>
            )}
            <Button variant="secondary" size="icon" aria-label="Previous day" onClick={() => go(addDays(day, -1))}>
              <ChevronLeft />
            </Button>
            <Button variant="secondary" size="icon" aria-label="Next day" onClick={() => go(addDays(day, 1))}>
              <ChevronRight />
            </Button>
            {menu}
          </>
        }
      />
      <div className="px-4 pb-3 md:px-8">
        <WeekStrip week={planner.week} selected={day} today={today} blocks={planner.weekBlocks} onSelect={go} />
      </div>
      <div className="grid min-h-0 flex-1 gap-4 px-4 pb-4 md:px-8 md:pb-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-3 px-3 pt-3 md:px-4">
            <FocusInput day={day} week={planner.week} />
            {isToday && now && planner.dayBlocks.length > 0 && !isWide && !isPhone && (
              <NowNext
                blocks={planner.dayBlocks}
                minute={minutesOfDay(now)}
                onOpen={(block) => planner.setEditor({ mode: "edit", block })}
              />
            )}
          </div>
          <div className="relative min-h-0 flex-1 pt-3">
            <DayTimeline
              className="h-full px-2 pb-24 md:pb-6"
              blocks={planner.dayBlocks}
              sleepRanges={planner.sleepRanges}
              hourHeight={hourHeight}
              snap={planner.snap}
              isToday={isToday}
              draft={planner.draftPreview}
              onCreateAt={(minute) => planner.createAt(minute)}
              onOpen={(block) => planner.setEditor({ mode: "edit", block })}
              onChangeTime={planner.changeTime}
              onToggleDone={planner.toggleDone}
              scrollTarget={scrollTarget}
              scrollKey={`${day}-${planner.isLoading}`}
            />
          </div>
        </Card>

        <aside className="hidden min-h-0 flex-col gap-4 lg:flex">
          <Card className="p-4">
            {isToday && now ? (
              <NowNext
                className="grid-cols-1!"
                blocks={planner.dayBlocks}
                minute={minutesOfDay(now)}
                onOpen={(block) => planner.setEditor({ mode: "edit", block })}
              />
            ) : null}
            <dl className={cn("grid grid-cols-3 gap-2 text-center", isToday && "mt-3")}>
              <div className="rounded-2xl bg-surface-sunken px-2 py-3">
                <dt className="text-[0.68rem] font-semibold tracking-wide text-faint uppercase">Planned</dt>
                <dd className="mt-0.5 text-base font-semibold whitespace-nowrap tabular">
                  {formatDuration(plannedMinutes)}
                </dd>
              </div>
              <div className="rounded-2xl bg-surface-sunken px-2 py-3">
                <dt className="text-[0.68rem] font-semibold tracking-wide text-faint uppercase">Free</dt>
                <dd className="mt-0.5 text-base font-semibold whitespace-nowrap tabular">
                  {formatDuration(Math.max(0, awakeMinutes - plannedMinutes))}
                </dd>
              </div>
              <div className="rounded-2xl bg-surface-sunken px-2 py-3">
                <dt className="text-[0.68rem] font-semibold tracking-wide text-faint uppercase">Done</dt>
                <dd className="mt-0.5 text-base font-semibold whitespace-nowrap tabular">
                  {doneCount}/{planner.dayBlocks.length}
                </dd>
              </div>
            </dl>
          </Card>
          <Card className="min-h-0 flex-1 overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-4 pb-2">
              <ListTodo className="size-4 text-accent" />
              <h2 className="text-[0.95rem] font-semibold">Plan from backlog</h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {openTodos.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted">Your backlog is empty.</p>
              ) : (
                <ul className="flex flex-col">
                  {openTodos.map((todo) => (
                    <li key={todo.id}>
                      <button
                        type="button"
                        onClick={() => planner.createAtNextFree({ title: todo.title, todoId: todo.id, color: "amber" })}
                        className="group flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-hover"
                      >
                        {todo.starred && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />}
                        <span className="min-w-0 flex-1 truncate text-sm">{todo.title}</span>
                        {todo.due_date && today && (
                          <span className="shrink-0 text-xs text-muted">{dueLabel(todo.due_date, today).text}</span>
                        )}
                        <Plus className="size-4 shrink-0 text-faint transition-colors group-hover:text-accent" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </aside>
      </div>

      <Button
        variant="primary"
        size="icon-lg"
        aria-label="Add block"
        onClick={() => planner.createAtNextFree()}
        className="fixed right-5 bottom-[calc(6.75rem+env(safe-area-inset-bottom))] z-30 rounded-full shadow-pop md:hidden"
      >
        <Plus className="!size-6" />
      </Button>

      <BlockEditor {...planner.editorProps} />
    </div>
  );
}
