"use client";

import { CalendarDays, CalendarPlus, Check, ChevronLeft, ChevronRight, Copy, ListTodo, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { MonthGrid } from "@/components/ui/month-grid";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { TimeField } from "@/components/ui/time-field";
import type { PlanBlock } from "@/data/core";
import { BLOCK_COLORS, type BlockColor } from "@/data/planner";
import { useToday } from "@/hooks/use-today";
import { addDays, type DayKey, formatDayMonth, formatWeekday, fromDayKey, relativeDayLabel } from "@/lib/date";
import { TODAY_RING, TODAY_TEXT } from "@/lib/tones";
import { clamp, formatDuration, MINUTES_PER_DAY } from "@/lib/time";
import { cn } from "@/lib/utils";
import { BLOCK_STYLES, blockStyle } from "./block-colors";

export type EditorState =
  | {
      mode: "create";
      day: DayKey;
      start: number;
      end: number;
      title?: string;
      color?: BlockColor;
      todoId?: string | null;
    }
  | { mode: "edit"; block: PlanBlock };

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];

export type BlockDraft = {
  day: DayKey;
  start_min: number;
  end_min: number;
  title: string;
  color: BlockColor;
  notes: string | null;
  done: boolean;
  todo_id: string | null;
};

export function BlockEditor({
  state,
  onClose,
  recent,
  snap,
  onCreate,
  onSave,
  onDelete,
  onCopyTo,
}: {
  state: EditorState | null;
  onClose: () => void;
  recent: PlanBlock[];
  snap: number;
  onCreate: (draft: BlockDraft) => void;
  onSave: (block: PlanBlock, draft: BlockDraft) => void;
  onDelete: (block: PlanBlock) => void;
  onCopyTo: (block: PlanBlock, day: DayKey) => void;
}) {
  const title = state?.mode === "edit" ? "Edit block" : "New block";
  return (
    <Sheet open={!!state} onOpenChange={(open) => !open && onClose()} title={title}>
      {state && (
        <EditorForm
          key={state.mode === "edit" ? state.block.id : `${state.day}-${state.start}`}
          state={state}
          recent={recent}
          snap={snap}
          onClose={onClose}
          onCreate={onCreate}
          onSave={onSave}
          onDelete={onDelete}
          onCopyTo={onCopyTo}
        />
      )}
    </Sheet>
  );
}

function EditorForm({
  state,
  recent,
  snap,
  onClose,
  onCreate,
  onSave,
  onDelete,
  onCopyTo,
}: {
  state: EditorState;
  recent: PlanBlock[];
  snap: number;
  onClose: () => void;
  onCreate: (draft: BlockDraft) => void;
  onSave: (block: PlanBlock, draft: BlockDraft) => void;
  onDelete: (block: PlanBlock) => void;
  onCopyTo: (block: PlanBlock, day: DayKey) => void;
}) {
  const existing = state.mode === "edit" ? state.block : null;
  const [title, setTitle] = useState(existing?.title ?? (state.mode === "create" ? (state.title ?? "") : ""));
  const [start, setStart] = useState(existing?.start_min ?? (state.mode === "create" ? state.start : 540));
  const [end, setEnd] = useState(existing?.end_min ?? (state.mode === "create" ? state.end : 600));
  const [color, setColor] = useState<BlockColor>(
    (existing?.color as BlockColor) ?? (state.mode === "create" ? (state.color ?? "violet") : "violet"),
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [done, setDone] = useState(existing?.done ?? false);
  const [day, setDay] = useState<DayKey>(existing?.day ?? (state.mode === "create" ? state.day : ""));
  const [pickerOpen, setPickerOpen] = useState(false);
  const today = useToday();
  const todoId = existing?.todo_id ?? (state.mode === "create" ? (state.todoId ?? null) : null);

  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: PlanBlock[] = [];
    for (const b of [...recent].sort((a, b) => b.updated_at.localeCompare(a.updated_at))) {
      const key = b.title.trim().toLowerCase();
      if (seen.has(key) || key === title.trim().toLowerCase()) continue;
      seen.add(key);
      out.push(b);
      if (out.length >= 8) break;
    }
    return out;
  }, [recent, title]);

  const duration = end - start;

  const setStartKeepDuration = (value: number) => {
    const length = end - start;
    const nextStart = clamp(value, 0, MINUTES_PER_DAY - snap);
    setStart(nextStart);
    setEnd(Math.min(MINUTES_PER_DAY, nextStart + length));
  };

  const draft = (): BlockDraft => ({
    day,
    start_min: start,
    end_min: Math.max(end, start + 5),
    title: title.trim(),
    color,
    notes: notes.trim() || null,
    done,
    todo_id: todoId,
  });

  const submit = () => {
    if (!title.trim()) return;
    if (existing) onSave(existing, draft());
    else onCreate(draft());
    onClose();
  };

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div>
        <Label>Day</Label>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" aria-label="Day before" onClick={() => setDay(addDays(day, -1))}>
            <ChevronLeft />
          </Button>
          <button
            type="button"
            aria-expanded={pickerOpen}
            aria-label="Pick the day"
            onClick={() => setPickerOpen((o) => !o)}
            className={cn(
              "flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-3 text-[0.95rem] font-medium transition-colors well hover:bg-surface-hover",
              day === today && cn("border-transparent", TODAY_RING, TODAY_TEXT),
            )}
          >
            <CalendarDays className="size-4 shrink-0" />
            <span className="truncate">
              {today && ["Today", "Tomorrow", "Yesterday"].includes(relativeDayLabel(day, today))
                ? `${relativeDayLabel(day, today)} · ${formatDayMonth(fromDayKey(day))}`
                : `${formatWeekday(fromDayKey(day))}, ${formatDayMonth(fromDayKey(day))}`}
            </span>
          </button>
          <Button variant="secondary" size="icon" aria-label="Day after" onClick={() => setDay(addDays(day, 1))}>
            <ChevronRight />
          </Button>
        </div>
        {pickerOpen && (
          <MonthGrid
            className="mt-3 rounded-2xl border border-line p-3"
            selected={day}
            today={today}
            tone="rose"
            onSelect={(picked) => {
              setDay(picked);
              setPickerOpen(false);
            }}
          />
        )}
      </div>

      <div>
        <Label htmlFor="block-title">What</Label>
        <Input
          id="block-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Deep work, Gym, Groceries"
          maxLength={120}
          autoComplete="off"
          enterKeyHint="done"
        />
        {suggestions.length > 0 && (
          <div className="-mx-1 mt-2 no-scrollbar flex gap-1.5 overflow-x-auto px-1 pb-1">
            {suggestions.map((s) => {
              const st = blockStyle(s.color);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setTitle(s.title);
                    setColor((s.color as BlockColor) ?? "violet");
                    if (!existing) setEnd(Math.min(MINUTES_PER_DAY, start + (s.end_min - s.start_min)));
                  }}
                  className="flex h-9 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors well hover:bg-surface-hover"
                >
                  <span className={cn("size-2.5 rounded-full", st.swatch)} />
                  {s.title}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Start</Label>
          <TimeField
            value={start}
            onChange={setStartKeepDuration}
            max={MINUTES_PER_DAY - snap}
            step={snap}
            label="Start"
          />
        </div>
        <div>
          <Label>End</Label>
          <TimeField
            value={end}
            onChange={(v) => setEnd(Math.max(v, start + snap))}
            min={start + snap}
            max={MINUTES_PER_DAY}
            step={snap}
            label="End"
          />
        </div>
      </div>

      <div className="-mt-2 flex flex-wrap gap-1.5">
        {DURATIONS.map((d) => (
          <button
            key={d}
            type="button"
            disabled={start + d > MINUTES_PER_DAY}
            onClick={() => setEnd(start + d)}
            className={cn(
              "h-9 rounded-full border px-3.5 text-sm font-medium transition-colors disabled:opacity-30",
              duration === d
                ? "border-transparent bg-accent text-accent-fg"
                : "border-line bg-surface-sunken text-muted hover:text-fg",
            )}
          >
            {formatDuration(d)}
          </button>
        ))}
      </div>

      <div>
        <Label>Colour</Label>
        <div className="flex flex-wrap gap-2">
          {BLOCK_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={cn(
                "grid size-10 place-items-center rounded-full transition-transform active:scale-90",
                BLOCK_STYLES[c].swatch,
                color === c && "ring-2 ring-fg ring-offset-2 ring-offset-[var(--surface-strong)]",
              )}
            >
              {color === c && <Check className="size-4 text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="block-notes">Notes</Label>
        <Textarea
          id="block-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional details"
          maxLength={4000}
          className="min-h-20"
        />
      </div>

      {existing && (
        <label className="flex items-center justify-between rounded-2xl bg-surface-sunken px-4 py-3">
          <span className="font-medium">Done</span>
          <Switch checked={done} onCheckedChange={setDone} label="Done" />
        </label>
      )}

      {todoId && (
        <p className="flex items-start gap-2 rounded-2xl bg-yellow-400/16 px-4 py-3 text-sm text-muted">
          <ListTodo className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-300" />
          From your backlog – ticking it off here ticks it off there too.
        </p>
      )}

      <div className="sticky -bottom-6 z-10 -mx-6 -mb-6 flex flex-wrap items-center gap-2 border-t border-line bg-surface-strong px-6 py-4">
        {existing && (
          <>
            <Button
              variant="danger"
              size="icon"
              aria-label="Delete block"
              onClick={() => {
                onDelete(existing);
                onClose();
              }}
            >
              <Trash2 />
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                onCopyTo(existing, addDays(existing.day, 1));
                onClose();
              }}
            >
              <Copy /> Copy to tomorrow
            </Button>
          </>
        )}
        <Button type="submit" variant="primary" className="ml-auto" disabled={!title.trim()}>
          {existing ? (
            "Save"
          ) : (
            <>
              <CalendarPlus /> Add to plan
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
