"use client";

import { Cake, Flag, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { type BirthdayInput, useBirthdays, useDeleteBirthday, useSaveBirthday } from "@/data/birthdays";
import { type Birthday, newId } from "@/data/core";
import { type CalendarPreferences, useSettings, useSettingsRow, useUpdateSettings } from "@/data/settings";
import { useToday } from "@/hooks/use-today";
import { ageOn, isValidBirthday, nextBirthday } from "@/lib/birthdays";
import { diffInDays, formatDayMonth, fromDayKey } from "@/lib/date";
import { HOLIDAY_REGIONS, type HolidayRegion } from "@/lib/holidays";
import { cn } from "@/lib/utils";
import { Row, Section } from "./section";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SELECT = "well field h-12 rounded-2xl px-3 text-[0.95rem] outline-none focus:border-accent/60";

export function useCalendarPreferences() {
  const { settings } = useSettings();
  const row = useSettingsRow();
  const update = useUpdateSettings();
  const set = (patch: Partial<CalendarPreferences>) => {
    if (row.data) update.mutate({ current: row.data, calendar: { ...settings.calendar, ...patch } });
  };
  // Until the row is loaded a change would be lost – the controls wait for it.
  return [settings.calendar, set, !row.data] as const;
}

/** Public holidays in the planner, for the chosen state – with what they mean for the shops. */
export function HolidaysSection() {
  const [calendar, set, loading] = useCalendarPreferences();
  return (
    <Section
      icon={<Flag />}
      title="Public holidays"
      description="Shown in your planner, with whether the shops are open."
    >
      <Row label="Show holidays">
        <Switch
          checked={calendar.holidays}
          onCheckedChange={(holidays) => set({ holidays })}
          label="Show holidays"
          disabled={loading}
        />
      </Row>
      <Row label="State" hint={calendar.region === "BY" ? "Includes Assumption Day (15 Aug), as in Munich" : undefined}>
        <select
          aria-label="State for public holidays"
          value={calendar.region}
          disabled={loading}
          onChange={(e) => set({ region: e.target.value as HolidayRegion })}
          className={cn(SELECT, "max-w-full")}
        >
          {HOLIDAY_REGIONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </Row>
    </Section>
  );
}

type Draft = { id: string | null; name: string; day: string; month: string; year: string };

const EMPTY: Draft = { id: null, name: "", day: "", month: "", year: "" };

function toInput(draft: Draft): BirthdayInput | null {
  const day = Number(draft.day);
  const month = Number(draft.month);
  const year = draft.year.trim() ? Number(draft.year) : null;
  if (!draft.name.trim() || !isValidBirthday(day, month, year)) return null;
  return { name: draft.name.trim(), day, month, year };
}

/** Friends and family with their birthday (the year is optional) – a simple list. */
export function BirthdaysSection() {
  const [calendar, set, loading] = useCalendarPreferences();
  const birthdays = useBirthdays();
  const save = useSaveBirthday();
  const remove = useDeleteBirthday();
  const today = useToday();
  const [draft, setDraft] = useState<Draft | null>(null);

  // Upcoming first.
  const list = [...(birthdays.data ?? [])]
    .map((b) => ({ birthday: b, next: today ? nextBirthday(b, today) : null }))
    .sort((a, b) => (a.next ?? "").localeCompare(b.next ?? "") || a.birthday.name.localeCompare(b.birthday.name));

  const open = (b?: Birthday) =>
    setDraft(
      b
        ? { id: b.id, name: b.name, day: String(b.day), month: String(b.month), year: b.year ? String(b.year) : "" }
        : EMPTY,
    );

  const input = draft ? toInput(draft) : null;
  const submit = () => {
    if (!draft || !input) return;
    save.mutate({ ...input, id: draft.id ?? newId(), isNew: !draft.id });
    setDraft(null);
  };

  return (
    <Section
      icon={<Cake />}
      title="Birthdays"
      description="Shown in your planner on the day – with the age if you know the year."
    >
      <Row label="Show birthdays">
        <Switch
          checked={calendar.birthdays}
          onCheckedChange={(birthdays) => set({ birthdays })}
          label="Show birthdays"
          disabled={loading}
        />
      </Row>
      <ul className="-mx-2 flex flex-col border-t border-line pt-2">
        {list.map(({ birthday, next }) => {
          const days = next && today ? diffInDays(next, today) : null;
          const age = next ? ageOn(birthday, next) : null;
          return (
            <li key={birthday.id}>
              <button
                type="button"
                onClick={() => open(birthday)}
                aria-label={`Edit ${birthday.name}`}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-surface-hover"
              >
                <Cake className="size-4 shrink-0 text-pink-500 dark:text-pink-300" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{birthday.name}</span>
                  <span className="block text-sm text-muted tabular">
                    {birthday.day} {MONTHS[birthday.month - 1]}
                    {birthday.year ? ` ${birthday.year}` : ""}
                  </span>
                </span>
                {days !== null && (
                  <span
                    className={cn(
                      "shrink-0 text-right text-xs",
                      days === 0 ? "font-semibold text-pink-600 dark:text-pink-300" : "text-muted",
                    )}
                  >
                    {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `in ${days} days`}
                    {age !== null && age > 0 && <span className="block">turns {age}</span>}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && !birthdays.isLoading && <p className="py-2 text-sm text-muted">No birthdays yet.</p>}
      <Button variant="secondary" className="mt-2 w-full" onClick={() => open()}>
        <Plus /> Add birthday
      </Button>

      <Sheet
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? "Edit birthday" : "New birthday"}
        size="sm"
        footer={
          <>
            {draft?.id && (
              <Button
                variant="danger"
                size="icon"
                aria-label="Delete birthday"
                onClick={() => {
                  const id = draft.id!;
                  remove.mutate({ id });
                  toast(`Deleted ${draft.name}'s birthday`);
                  setDraft(null);
                }}
              >
                <Trash2 />
              </Button>
            )}
            <Button variant="primary" className="ml-auto" disabled={!input} onClick={submit}>
              Save
            </Button>
          </>
        }
      >
        {draft && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Name"
              aria-label="Name"
              maxLength={80}
              autoComplete="off"
            />
            <div className="grid grid-cols-[5rem_minmax(0,1fr)_6.5rem] gap-2">
              <select
                aria-label="Day"
                value={draft.day}
                onChange={(e) => setDraft({ ...draft, day: e.target.value })}
                className={SELECT}
              >
                <option value="">Day</option>
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
              <select
                aria-label="Month"
                value={draft.month}
                onChange={(e) => setDraft({ ...draft, month: e.target.value })}
                className={SELECT}
              >
                <option value="">Month</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <Input
                value={draft.year}
                onChange={(e) => setDraft({ ...draft, year: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                placeholder="Year"
                aria-label="Year (optional)"
                inputMode="numeric"
                className="px-3"
              />
            </div>
            <p className="text-sm text-muted">
              {input && today
                ? `Next: ${formatDayMonth(fromDayKey(nextBirthday(input, today)))}${
                    input.year && ageOn(input, nextBirthday(input, today))
                      ? ` · turns ${ageOn(input, nextBirthday(input, today))}`
                      : ""
                  }`
                : "The year is optional – with it, the planner shows the age."}
            </p>
            <button type="submit" hidden />
          </form>
        )}
      </Sheet>
    </Section>
  );
}
