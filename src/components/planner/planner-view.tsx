"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CalendarPlus, ClipboardCopy, Eraser, ListTodo, MoreHorizontal, Plus } from "lucide-react";
import { motion } from "motion/react";
import { DropdownMenu } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { queryKeys, type Todo } from "@/data/core";
import { fetchBlocks, plannedBlockByTodo, useLinkedBlocks } from "@/data/planner";
import { sortOpenTodos, todoHeadline, useTodos } from "@/data/todos";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useNow } from "@/hooks/use-now";
import { useSwipe } from "@/hooks/use-swipe";
import {
  addDays,
  type DayKey,
  diffInDays,
  formatDayMonth,
  formatDayMonthShort,
  formatWeekday,
  fromDayKey,
  isoWeek,
  relativeDayLabel,
} from "@/lib/date";
import { afterSheetClosed } from "@/lib/history";
import { planDay, planDuration, planStart } from "@/lib/plan-todo";
import { TONE_STYLES } from "@/lib/tones";
import { formatDuration, MINUTES_PER_DAY, minutesOfDay } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useDayExtras } from "@/data/calendar";
import { BacklogPlanList } from "./backlog-plan-list";
import { BlockEditor } from "./block-editor";
import { DayExtrasChips } from "./day-extras";
import { DayTimeline } from "./day-timeline";
import { FocusInput } from "./focus-input";
import { MonthCalendar } from "./month-calendar";
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

export function PlannerView({
  day,
  today,
  onDayChange,
  planTodoId,
  onPlanHandled,
}: {
  day: DayKey;
  today: DayKey | null;
  onDayChange: (day: DayKey) => void;
  /** A backlog item to plan (or to show, if already planned) – from the backlog page. */
  planTodoId?: string | null;
  onPlanHandled?: () => void;
}) {
  const now = useNow("minute");
  const planner = usePlanner(day);
  const todos = useTodos();
  const linked = useLinkedBlocks();
  const queryClient = useQueryClient();
  const isWide = useMediaQuery("(min-width: 1024px)");
  const isPhone = useMediaQuery("(max-width: 767px)");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [backlogOpen, setBacklogOpen] = useState(false);
  const [direction, setDirection] = useState(1);

  const go = (target: DayKey) => {
    if (target === day) return;
    setDirection(diffInDays(target, day) > 0 ? 1 : -1);
    onDayChange(target);
  };

  const planned = useMemo(() => plannedBlockByTodo(linked.data, today), [linked.data, today]);

  /**
   * Puts a backlog item into the plan: on its due date (or the day you look
   * at), from waking up, 3 h when important and 1 h otherwise – opened in the
   * editor so day and time can still be changed. Already planned? Jump there.
   */
  const planTodo = async (todo: Todo) => {
    const existing = planned.get(todo.id);
    if (existing) {
      go(existing.day);
      planner.setEditor({ mode: "edit", block: existing });
      return;
    }
    if (!today) return;
    const target = planDay(todo, today, day);
    const blocks = await queryClient.fetchQuery({
      queryKey: queryKeys.blockRange(target, target),
      queryFn: () => fetchBlocks(target, target),
      staleTime: 30_000,
    });
    const duration = planDuration(todo);
    const start = planStart({
      schedule: planner.settings.sleepSchedule,
      day: target,
      today,
      nowMinute: minutesOfDay(new Date()),
      blocks,
      duration,
      snap: planner.snap,
    });
    go(target);
    planner.setEditor({
      mode: "create",
      day: target,
      start,
      end: Math.min(MINUTES_PER_DAY, start + duration),
      title: todoHeadline(todo.title),
      todoId: todo.id,
      color: "amber",
    });
  };

  // Coming from the backlog page with "Plan it" / "Show in planner".
  const handledPlan = useRef<string | null>(null);
  useEffect(() => {
    if (!planTodoId || handledPlan.current === planTodoId || !todos.data || !linked.data || !today) return;
    handledPlan.current = planTodoId;
    const todo = todos.data.find((t) => t.id === planTodoId);
    window.setTimeout(() => {
      onPlanHandled?.();
      if (todo) void planTodo(todo);
    }, 0);
    // planTodo only reads current data; run once per requested item.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planTodoId, todos.data, linked.data, today]);

  // Swipe sideways (or use the arrow keys) to flip through the days.
  const editing = planner.editor !== null;
  const swipe = useSwipe((dir) => go(addDays(day, dir)), !editing && !calendarOpen);
  useEffect(() => {
    if (editing || calendarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable='true'], [role='menu']")) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const step = e.key === "ArrowLeft" ? -1 : 1;
      setDirection(step);
      onDayChange(addDays(day, step));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [day, editing, calendarOpen, onDayChange]);

  const openTodos = useMemo(() => sortOpenTodos(todos.data ?? []), [todos.data]);
  const dayExtras = useDayExtras();
  const isToday = day === today;
  const hourHeight = isPhone ? 56 : 64;
  const plannedMinutes = planner.dayBlocks.reduce((sum, b) => sum + (b.end_min - b.start_min), 0);
  const doneCount = planner.dayBlocks.filter((b) => b.done).length;
  const awakeMinutes = planner.awake[1] - planner.awake[0];
  // Open the day with just its last hour of sleep at the top (or earlier for an early block).
  const scrollTarget = Math.max(0, Math.min(planner.awake[0] - 60, ...planner.dayBlocks.map((b) => b.start_min - 30)));

  const date = fromDayKey(day);
  // "Friday (Tomorrow)": the weekday leads, the relative day follows quietly.
  const label = today ? relativeDayLabel(day, today) : "";
  const relative = ["Today", "Tomorrow", "Yesterday"].includes(label) ? label : null;
  const title = formatWeekday(date);
  const sameYear = !today || today.slice(0, 4) === day.slice(0, 4);
  const year = sameYear ? "" : ` ${date.getFullYear()}`;
  const week = ` · Week ${isoWeek(day)}`;
  const rose = TONE_STYLES.rose;

  const menu = (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="secondary" size="icon" aria-label="More actions" className="max-md:size-10">
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
    <div className="flex h-[calc(100dvh-var(--page-bottom))] flex-col md:h-dvh" {...swipe}>
      {/* On phones the title gets its own line, so a long weekday never wraps. */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 md:items-end md:px-8 md:pt-7">
        <h1 className="ui-title col-span-2 truncate text-[1.75rem] leading-tight font-semibold tracking-tight md:col-span-1 md:text-[2rem]">
          {title}
          {relative && " "}
          {relative && <span className="text-[0.62em] font-medium tracking-normal text-muted">({relative})</span>}
        </h1>
        <p className="truncate text-sm text-muted md:col-start-1 md:row-start-2 md:text-[0.95rem]">
          {/* Phones: the short month, so it fits next to the buttons. */}
          <span className="md:hidden">{formatDayMonthShort(date)}</span>
          <span className="max-md:hidden">{formatDayMonth(date)}</span>
          {year}
          {week}
        </p>
        <div className="flex items-center gap-1.5 md:col-start-2 md:row-span-2 md:row-start-1 md:gap-2">
          {!isToday && today && (
            <Button variant="secondary" size="sm" className="px-3 max-md:h-10" onClick={() => go(today)}>
              Today
            </Button>
          )}
          <Button
            variant="secondary"
            size="icon"
            aria-label="Plan from backlog"
            className="max-md:size-10 lg:hidden"
            onClick={() => setBacklogOpen(true)}
          >
            <ListTodo className="text-yellow-600 dark:text-yellow-300" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            aria-label="Pick a day"
            className="max-md:size-10 lg:hidden"
            onClick={() => setCalendarOpen(true)}
          >
            <CalendarDays />
          </Button>
          {menu}
        </div>
      </header>
      <div className="px-4 pb-3 md:px-8">
        <WeekStrip week={planner.week} selected={day} today={today} blocks={planner.weekBlocks} onSelect={go} />
      </div>
      <div className="grid min-h-0 flex-1 gap-4 px-4 md:px-8 md:pb-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="min-h-0 [touch-action:pan-y] overflow-hidden">
          {/* Phones: "add" sits in the card's corner, near the thumb. */}
          <Button
            variant="primary"
            size="icon-lg"
            aria-label="Add block"
            onClick={() => planner.createAtNextFree()}
            className={cn("ui-action absolute right-4 bottom-4 z-30 rounded-full shadow-pop md:hidden", rose.solid)}
          >
            <Plus className="!size-6" />
          </Button>
          <div className="flex flex-col gap-3 px-3 pt-3 md:px-4">
            <FocusInput day={day} week={planner.week} />
            <DayExtrasChips extras={dayExtras(day)} className="-mt-1" />
            {isToday && now && planner.dayBlocks.length > 0 && !isWide && !isPhone && (
              <NowNext
                blocks={planner.dayBlocks}
                minute={minutesOfDay(now)}
                onOpen={(block) => planner.setEditor({ mode: "edit", block })}
              />
            )}
          </div>
          <motion.div
            key={day}
            initial={{ opacity: 0, x: direction * 28 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative min-h-0 flex-1 pt-3"
          >
            <DayTimeline
              className="h-full [touch-action:pan-y] px-2 pb-24 md:pb-6"
              blocks={planner.dayBlocks}
              sleepRanges={planner.sleepRanges}
              hourHeight={hourHeight}
              range={[0, planner.viewEnd]}
              snap={planner.snap}
              isToday={isToday}
              draft={planner.draftPreview}
              onCreateAt={(minute) => planner.createAt(minute)}
              onOpen={(block) => planner.setEditor({ mode: "edit", block })}
              onChangeTime={planner.changeTime}
              onToggleDone={planner.toggleDone}
              scrollTarget={scrollTarget}
              keepVisible={isToday && now ? minutesOfDay(now) : undefined}
              scrollKey={`${day}-${planner.isLoading}`}
            />
          </motion.div>
        </Card>

        {/* On short screens the column scrolls rather than squeezing the backlog away. */}
        <aside className="-m-3 hidden min-h-0 flex-col gap-4 overflow-y-auto p-3 lg:flex">
          <Card className="shrink-0 p-4">
            <MonthCalendar selected={day} today={today} onSelect={go} />
          </Card>
          <Card className="shrink-0 p-4">
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
          <Card className="min-h-64 flex-1 overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-4 pb-2">
              <ListTodo className="size-4 text-yellow-600 dark:text-yellow-300" />
              <h2 className="text-[0.95rem] font-semibold">Plan from backlog</h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              <BacklogPlanList
                todos={openTodos}
                planned={planned}
                today={today}
                onPlan={(todo) => void planTodo(todo)}
              />
            </div>
          </Card>
        </aside>
      </div>

      <Sheet
        open={backlogOpen}
        onOpenChange={setBacklogOpen}
        title="Plan from backlog"
        description="Planned items show where they are – tap one to jump there."
      >
        <BacklogPlanList
          className="-mx-3"
          todos={openTodos}
          planned={planned}
          today={today}
          onPlan={(todo) => {
            setBacklogOpen(false);
            afterSheetClosed(() => void planTodo(todo));
          }}
        />
      </Sheet>

      <Sheet open={calendarOpen} onOpenChange={setCalendarOpen} title="Pick a day" size="sm">
        <MonthCalendar
          selected={day}
          today={today}
          listFirst
          onSelect={(target) => {
            go(target);
            setCalendarOpen(false);
          }}
        />
      </Sheet>

      <BlockEditor {...planner.editorProps} />
    </div>
  );
}
