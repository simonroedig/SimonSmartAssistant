"use client";

import {
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  Eraser,
  ListTodo,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardMoreLink } from "@/components/ui/card";
import { CheckCircle } from "@/components/ui/check-circle";
import { AutoTextarea, Label } from "@/components/ui/input";
import { MonthGrid } from "@/components/ui/month-grid";
import { Sheet } from "@/components/ui/sheet";
import { DragHandle, SortableList } from "@/components/ui/sortable";
import { PHONE_ADD_ROW, PHONE_SCROLL_AREA } from "@/components/ui/phone-add-row";
import { SwipeRow } from "@/components/ui/swipe-row";
import type { PlanBlock, Todo } from "@/data/core";
import { plannedBlockByTodo, useLinkedBlocks, useSetTodoBlocksDone } from "@/data/planner";
import {
  prepareTodo,
  sortDoneTodos,
  sortOpenTodos,
  todoHeadline,
  type TodoPatch,
  useAddTodo,
  useDeleteTodos,
  useRestoreTodos,
  useTodos,
  useUpdateTodo,
} from "@/data/todos";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useToday } from "@/hooks/use-today";
import {
  addDays,
  type DayKey,
  dueLabel,
  formatDayMonth,
  formatNumericDate,
  formatWeekday,
  fromDayKey,
  weekdayIndex,
} from "@/lib/date";
import { positionAtStart, positionForMove } from "@/lib/ordering";
import { afterSheetClosed } from "@/lib/history";
import { plannedLabel } from "@/lib/plan-todo";
import { formatEndMinutes, formatMinutes } from "@/lib/time";
import { addButtonTone, FIELD_FOCUS, STAR_ON, TONE_STYLES } from "@/lib/tones";
import { cn, vibrate } from "@/lib/utils";

const DUE_TONES = {
  overdue: "bg-rose-500/12 text-rose-600 dark:text-rose-300",
  today: "bg-amber-500/14 text-amber-700 dark:text-amber-300",
  soon: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  later: "bg-surface-hover text-muted",
};

function TodoRow({
  todo,
  today,
  planned,
  onToggle,
  onStar,
  onOpen,
  onDelete,
}: {
  todo: Todo;
  today: DayKey | null;
  /** The plan block this item is scheduled in, if any. */
  planned?: PlanBlock;
  onToggle: () => void;
  onStar: () => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const due = todo.due_date && today ? dueLabel(todo.due_date, today) : null;
  const headline = todoHeadline(todo.title, 60);
  const [firstLine, ...more] = todo.title.trim().split("\n");
  const rest = more.join("\n").trim();
  return (
    <SwipeRow onDelete={onDelete}>
      <div className="flex items-start gap-1 rounded-2xl transition-colors hover:bg-surface-hover">
        {!todo.done && <DragHandle label={`Move "${headline}"`} className="-mr-2 h-12 self-start" />}
        <button
          type="button"
          aria-label={todo.done ? `Mark "${headline}" as open` : `Complete "${headline}"`}
          onClick={() => {
            vibrate(8);
            onToggle();
          }}
          className="grid size-12 shrink-0 place-items-center"
        >
          <CheckCircle checked={todo.done} />
        </button>
        <button
          type="button"
          onClick={onOpen}
          aria-label={headline}
          className="flex min-h-12 min-w-0 flex-1 flex-col justify-center py-2.5 text-left"
        >
          <span
            className={cn(
              "line-clamp-2 text-[0.98rem] leading-snug break-words",
              // Important: in bold, next to its filled star.
              todo.starred && !todo.done && "font-semibold",
              todo.done && "line-clamp-1 text-faint line-through decoration-faint/60",
            )}
          >
            {firstLine}
          </span>
          {rest && !todo.done && (
            <span className="mt-0.5 line-clamp-2 text-sm leading-snug break-words whitespace-pre-line text-muted">
              {rest}
            </span>
          )}
          {(due || planned) && !todo.done && (
            <span className="mt-1 flex flex-wrap gap-1.5">
              {due && (
                <span className={cn("rounded-full px-2 py-px text-[0.7rem] font-semibold", DUE_TONES[due.tone])}>
                  {due.text}
                </span>
              )}
              {planned && today && (
                <span className="flex items-center gap-1 rounded-full border border-rose-500/35 px-2 py-px text-[0.7rem] font-semibold text-rose-600 dark:text-rose-300">
                  <CalendarCheck className="size-3" />
                  {plannedLabel(planned, today)}
                </span>
              )}
            </span>
          )}
        </button>
        {!todo.done && (
          <button
            type="button"
            aria-label={todo.starred ? "Remove star" : "Star"}
            aria-pressed={todo.starred}
            onClick={onStar}
            className="grid size-11 shrink-0 place-items-center rounded-xl"
          >
            <Star
              className={cn("size-[1.1rem] transition-all", todo.starred ? cn("scale-110", STAR_ON) : "text-faint")}
            />
          </button>
        )}
      </div>
    </SwipeRow>
  );
}

export function TodoList({
  variant = "page",
  limit,
  className,
}: {
  variant?: "page" | "card";
  /** Home card on phones: only the first items, no inner scrolling – the rest is on the page. */
  limit?: number;
  className?: string;
}) {
  const todos = useTodos();
  const linked = useLinkedBlocks();
  const setBlocksDone = useSetTodoBlocksDone();
  const add = useAddTodo();
  const update = useUpdateTodo();
  const remove = useDeleteTodos();
  const restore = useRestoreTodos();
  const today = useToday();
  const planned = useMemo(() => plannedBlockByTodo(linked.data, today), [linked.data, today]);
  const [draft, setDraft] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<Todo | null>(null);

  const all = useMemo(() => todos.data ?? [], [todos.data]);
  const open = useMemo(() => sortOpenTodos(all), [all]);
  const done = useMemo(() => sortDoneTodos(all), [all]);
  const shown = limit ? open.slice(0, limit) : open;

  const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)");
  const addDraft = () => {
    if (!draft.trim()) return;
    add.mutate(prepareTodo({ title: draft, position: positionAtStart(open) }));
    setDraft("");
  };

  const deleteWithUndo = (items: Todo[], label: string) => {
    if (items.length === 0) return;
    remove.mutate({ ids: items.map((t) => t.id) });
    toast(label, { action: { label: "Undo", onClick: () => restore.mutate({ todos: items }) }, duration: 6000 });
  };

  // Ticking an item off also ticks off its blocks in the planner (and back).
  const setDone = (todo: Todo, done: boolean) => {
    update.mutate({ id: todo.id, patch: { done } });
    if (linked.data?.some((b) => b.todo_id === todo.id)) setBlocksDone.mutate({ todoId: todo.id, done });
  };

  const toggle = (todo: Todo) => {
    setDone(todo, !todo.done);
    if (!todo.done) {
      toast(`Done: ${todoHeadline(todo.title, 60)}`, {
        action: { label: "Undo", onClick: () => setDone(todo, false) },
        duration: 4000,
      });
    }
  };

  const onPage = variant === "page";
  const body = (
    <>
      <div className={cn(onPage && PHONE_ADD_ROW)}>
        <form
          className={cn("flex items-end gap-2", FIELD_FOCUS.yellow)}
          onSubmit={(e) => {
            e.preventDefault();
            addDraft();
          }}
        >
          <AutoTextarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Keyboard: Enter adds, Shift+Enter starts a new line. Touch keyboards keep Enter for new lines.
              if (e.key === "Enter" && !e.shiftKey && finePointer && !e.nativeEvent.isComposing) {
                e.preventDefault();
                addDraft();
              }
            }}
            placeholder="Add to your backlog…"
            aria-label="New todo"
            autoComplete="off"
            maxLength={5000}
            maxRows={8}
            className="py-[11px]"
          />
          <Button
            type="submit"
            variant="primary"
            size="icon"
            aria-label="Add todo"
            disabled={!draft.trim()}
            // Keep the focus (and the phone's keyboard) in the field: adding needs one tap.
            onMouseDown={(e) => e.preventDefault()}
            className={cn(
              "ui-action size-12 shrink-0 shadow-[0_8px_24px_-12px_rgb(250_204_21)]",
              addButtonTone("yellow", !!draft.trim()),
            )}
          >
            <Plus className="!size-5" />
          </Button>
        </form>
      </div>

      <div className={cn("mt-3", onPage && PHONE_SCROLL_AREA)}>
        {todos.isLoading && all.length === 0 ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-12" />
            ))}
          </div>
        ) : open.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted">
            <ListTodo className="size-8 text-faint" />
            <p className="text-sm">{done.length > 0 ? "All done. Nice!" : "Write down whatever is on your mind."}</p>
          </div>
        ) : (
          <SortableList
            items={shown}
            className="flex flex-col"
            onMove={(id, index) => update.mutate({ id, patch: { position: positionForMove(open, id, index) } })}
          >
            {(todo) => (
              <TodoRow
                todo={todo}
                today={today}
                planned={planned.get(todo.id)}
                onToggle={() => toggle(todo)}
                onStar={() => update.mutate({ id: todo.id, patch: { starred: !todo.starred } })}
                onOpen={() => setEditing(todo)}
                onDelete={() => deleteWithUndo([todo], `Deleted "${todoHeadline(todo.title, 60)}"`)}
              />
            )}
          </SortableList>
        )}

        {open.length > shown.length && (
          <CardMoreLink href="/todos" tone="yellow">
            {open.length - shown.length} more
          </CardMoreLink>
        )}

        {!limit && done.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                className="flex h-10 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold tracking-wide text-faint uppercase hover:text-muted"
              >
                <ChevronDown className={cn("size-4 transition-transform", showDone && "rotate-180")} />
                Completed · {done.length}
              </button>
              {showDone && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteWithUndo(done, `Cleared ${done.length} completed`)}
                >
                  <Eraser /> Clear
                </Button>
              )}
            </div>
            <AnimatePresence initial={false}>
              {showDone && (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex flex-col overflow-hidden"
                >
                  {done.slice(0, 50).map((todo) => (
                    <li key={todo.id}>
                      <TodoRow
                        todo={todo}
                        today={today}
                        onToggle={() => toggle(todo)}
                        onStar={() => undefined}
                        onOpen={() => setEditing(todo)}
                        onDelete={() => deleteWithUndo([todo], `Deleted "${todoHeadline(todo.title, 60)}"`)}
                      />
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <TodoEditor
        todo={editing}
        today={today}
        planned={editing ? planned.get(editing.id) : undefined}
        onClose={() => setEditing(null)}
        onSave={(patch) => editing && update.mutate({ id: editing.id, patch })}
        onDelete={() => editing && deleteWithUndo([editing], `Deleted "${todoHeadline(editing.title, 60)}"`)}
      />
    </>
  );

  if (variant === "card") {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader icon={<ListTodo />} title="Backlog" count={open.length} tone="yellow" href="/todos" />
        <div className={cn("px-4 pb-4", !limit && "min-h-0 flex-1 overflow-y-auto")}>{body}</div>
      </Card>
    );
  }
  return <div className={className}>{body}</div>;
}

function TodoEditor({
  todo,
  today,
  planned,
  onClose,
  onSave,
  onDelete,
}: {
  todo: Todo | null;
  today: DayKey | null;
  planned?: PlanBlock;
  onClose: () => void;
  onSave: (patch: TodoPatch) => void;
  onDelete: () => void;
}) {
  return (
    <Sheet open={!!todo} onOpenChange={(o) => !o && onClose()} title="Backlog item">
      {todo && today && (
        <TodoForm
          key={todo.id}
          todo={todo}
          today={today}
          planned={planned}
          onClose={onClose}
          onSave={onSave}
          onDelete={onDelete}
        />
      )}
    </Sheet>
  );
}

function TodoForm({
  todo,
  today,
  planned,
  onClose,
  onSave,
  onDelete,
}: {
  todo: Todo;
  today: DayKey;
  planned?: PlanBlock;
  onClose: () => void;
  onSave: (patch: TodoPatch) => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(todo.title);
  const [due, setDue] = useState<string | null>(todo.due_date);
  const [starred, setStarred] = useState(todo.starred);
  const [pickerOpen, setPickerOpen] = useState(false);

  const saturday = addDays(today, (5 - weekdayIndex(today) + 7) % 7 || 7);
  const nextMonday = addDays(today, 7 - weekdayIndex(today));
  const presets: { label: string; value: string | null }[] = [
    { label: "None", value: null },
    { label: "Today", value: today },
    { label: "Tomorrow", value: addDays(today, 1) },
    { label: "Weekend", value: weekdayIndex(today) >= 5 ? today : saturday },
    { label: "Next week", value: nextMonday },
  ];

  const customDue = due !== null && !presets.some((p) => p.value === due);

  const save = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), due_date: due, starred });
    onClose();
  };

  /**
   * Plan it (or show where it is planned): saves the edits, then opens the
   * planner on the right day with the block editor ready.
   */
  const openInPlanner = () => {
    if (title.trim()) onSave({ title: title.trim(), due_date: due, starred });
    onClose();
    const url = planned ? `/planner?day=${planned.day}&plan=${todo.id}` : `/planner?plan=${todo.id}`;
    afterSheetClosed(() => router.push(url));
  };

  return (
    <form
      className={cn("flex flex-col gap-5", FIELD_FOCUS.yellow)}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <AutoTextarea
        id="todo-text"
        aria-label="Text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={5000}
        minRows={3}
        maxRows={14}
        className="text-[1rem]"
      />
      <div>
        <Label>Due</Label>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setDue(p.value)}
              className={cn(
                "h-9 rounded-full border px-3.5 text-sm font-medium transition-colors",
                due === p.value
                  ? cn("border-transparent", TONE_STYLES.yellow.solid)
                  : "border-line bg-surface-sunken text-muted hover:text-fg",
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((o) => !o)}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
              customDue
                ? cn("border-transparent", TONE_STYLES.yellow.solid)
                : "border-line bg-surface-sunken text-muted hover:text-fg",
            )}
          >
            <CalendarDays className="size-4" />
            {customDue ? dueLabel(due!, today).text : "Pick date"}
          </button>
        </div>
        {pickerOpen && (
          // Our own calendar: works the same on the phone, the laptop and the wall display.
          <MonthGrid
            className="mt-3 rounded-2xl border border-line p-3"
            selected={due}
            today={today}
            tone="yellow"
            onSelect={(day) => {
              setDue(day);
              setPickerOpen(false);
            }}
          />
        )}
      </div>
      <button
        type="button"
        onClick={() => setStarred((s) => !s)}
        className="flex items-center justify-between rounded-2xl bg-surface-sunken px-4 py-3"
        aria-pressed={starred}
      >
        <span className="font-medium">Important</span>
        <Star className={cn("size-5", starred ? STAR_ON : "text-faint")} />
      </button>
      {planned && (
        <p className="flex items-center gap-2 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
          <CalendarCheck className="size-4 shrink-0" />
          In your plan: {formatWeekday(fromDayKey(planned.day))}, {formatDayMonth(fromDayKey(planned.day))} ·{" "}
          {formatMinutes(planned.start_min)}–{formatEndMinutes(planned.end_min)}
        </p>
      )}
      <p className="text-xs text-faint">
        Created {formatNumericDate(new Date(todo.created_at))}
        {todo.done_at ? ` · done ${formatNumericDate(new Date(todo.done_at))}` : ""}
      </p>
      <div className="sticky -bottom-6 z-10 -mx-6 -mb-6 flex flex-wrap items-center gap-2 border-t border-line bg-surface-strong px-6 py-4">
        <Button
          variant="danger"
          size="icon"
          aria-label="Delete"
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          <Trash2 />
        </Button>
        {!todo.done &&
          (planned ? (
            <Button variant="secondary" onClick={openInPlanner}>
              <CalendarCheck /> Show in planner
            </Button>
          ) : (
            <Button variant="secondary" onClick={openInPlanner}>
              <CalendarPlus /> Plan it
            </Button>
          ))}
        <Button
          type="submit"
          variant="primary"
          className={cn("ui-action ml-auto shadow-none", TONE_STYLES.yellow.solid)}
          disabled={!title.trim()}
        >
          Save
        </Button>
      </div>
    </form>
  );
}
