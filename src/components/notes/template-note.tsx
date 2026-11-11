"use client";

import { Check, ChevronDown, Plus, RotateCcw, Trash2, Wind } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CHIP, CHIP_IDLE, CHIP_ON } from "@/components/ui/chip";
import { AutoTextarea } from "@/components/ui/input";
import { newId, nowIso } from "@/data/core";
import { formatDayMonthShort } from "@/lib/date";
import {
  entryLabel,
  isEntryEmpty,
  type NoteTemplate,
  sortEntries,
  type TemplateEntry,
  type TemplateField,
  type TemplateId,
} from "@/lib/note-templates";
import { TONE_STYLES } from "@/lib/tones";
import { cn } from "@/lib/utils";

/** Done (checked off) – in green, like the to-dos. */
const DONE_TONE = TONE_STYLES.emerald;

const ICONS: Record<TemplateId, typeof Wind> = { letgo: Wind };

export function TemplateIcon({ template, className }: { template: NoteTemplate; className?: string }) {
  const Icon = ICONS[template.id];
  return <Icon className={className} />;
}

export function newEntry(): TemplateEntry {
  return { id: newId(), at: nowIso(), values: {}, done_at: null };
}

/** On a note's card: how many are open and done, and the open ones' names. */
export function TemplateSummary({
  template,
  entries,
  lines,
}: {
  template: NoteTemplate;
  entries: TemplateEntry[];
  lines: number;
}) {
  const { open, done } = sortEntries(entries.filter((e) => !isEntryEmpty(e)));
  return (
    <span className="flex flex-col gap-1 text-[0.92rem] leading-snug">
      <span className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs font-medium">
        {open.length > 0 && <span className="text-fg">{open.length} open</span>}
        <span className={DONE_TONE.text}>
          <Check className="mr-0.5 inline size-3.5 -translate-y-px" strokeWidth={2.6} />
          {done.length} {template.doneLabel.toLowerCase()}
        </span>
      </span>
      {open.slice(0, lines).map((entry) => (
        <span key={entry.id} className="block truncate text-muted">
          {entryLabel(template, entry) || `New ${template.entry}`}
        </span>
      ))}
    </span>
  );
}

/**
 * The note's entries, to fill in and check off: the open ones as forms (newest on
 * top), the checked-off ones folded away underneath.
 */
export function TemplateEntries({
  template,
  entries,
  onChange,
  focusId,
}: {
  template: NoteTemplate;
  entries: TemplateEntry[];
  onChange: (entries: TemplateEntry[]) => void;
  /** An entry just added: its first field gets the caret. */
  focusId?: string | null;
}) {
  const [focus, setFocus] = useState<string | null>(focusId ?? null);
  const { open, done } = sortEntries(entries);
  const set = (id: string, change: Partial<TemplateEntry>) =>
    onChange(entries.map((e) => (e.id === id ? { ...e, ...change } : e)));
  const remove = (id: string) => onChange(entries.filter((e) => e.id !== id));
  const add = () => {
    const entry = newEntry();
    setFocus(entry.id);
    onChange([...entries, entry]);
  };

  return (
    <div className="flex flex-col gap-3">
      <Button variant="secondary" onClick={add} className="self-start">
        <Plus /> New {template.entry}
      </Button>

      <AnimatePresence initial={false}>
        {open.map((entry) => (
          <motion.div
            key={entry.id}
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
          >
            <EntryForm
              template={template}
              entry={entry}
              autoFocus={focus === entry.id}
              onValue={(key, value) => set(entry.id, { values: { ...entry.values, [key]: value } })}
              onDone={() => set(entry.id, { done_at: nowIso() })}
              onRemove={() => remove(entry.id)}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {open.length === 0 && (
        <p className="px-1 text-sm text-muted">
          Nothing open. When a moment keeps replaying, add it here and walk it through.
        </p>
      )}

      {done.length > 0 && (
        <details className="group rounded-2xl px-4 py-3 well">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
            <Check className={cn("size-4", DONE_TONE.text)} strokeWidth={2.6} />
            {template.doneLabel} · {done.length}
            <ChevronDown className="ml-auto size-4 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <ul className="mt-2 flex flex-col">
            {done.map((entry) => (
              <DoneEntry
                key={entry.id}
                template={template}
                entry={entry}
                onReopen={() => set(entry.id, { done_at: null })}
                onRemove={() => remove(entry.id)}
              />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function EntryForm({
  template,
  entry,
  autoFocus,
  onValue,
  onDone,
  onRemove,
}: {
  template: NoteTemplate;
  entry: TemplateEntry;
  autoFocus: boolean;
  onValue: (key: string, value: string) => void;
  onDone: () => void;
  onRemove: () => void;
}) {
  return (
    <section
      aria-label={entryLabel(template, entry) || `New ${template.entry}`}
      className="flex flex-col gap-3.5 rounded-2xl border border-line p-3.5"
    >
      <div className="-mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-faint">{formatDayMonthShort(new Date(entry.at))}</span>
        <button
          type="button"
          aria-label={`Remove this ${template.entry}`}
          onClick={onRemove}
          className="-m-1.5 grid size-8 place-items-center rounded-lg text-faint transition-colors hover:bg-surface-hover hover:text-fg"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      {template.fields.map((field, i) => (
        <Field key={field.key} field={field} values={entry.values} autoFocus={autoFocus && i === 0} onValue={onValue} />
      ))}
      <Button
        variant="primary"
        disabled={isEntryEmpty(entry)}
        onClick={onDone}
        className={cn("ui-action self-end shadow-none", DONE_TONE.solid)}
      >
        <Check strokeWidth={2.6} /> {template.doneAction}
      </Button>
    </section>
  );
}

function Field({
  field,
  values,
  autoFocus,
  onValue,
}: {
  field: TemplateField;
  values: Record<string, string>;
  autoFocus: boolean;
  onValue: (key: string, value: string) => void;
}) {
  const value = values[field.key] ?? "";
  const labelClass = "mb-1.5 block px-1 text-[0.82rem] font-medium text-muted";
  if (field.kind === "text") {
    return (
      <label className="block">
        <span className={labelClass}>{field.label}</span>
        <AutoTextarea
          value={value}
          onChange={(e) => onValue(field.key, e.target.value)}
          placeholder={field.placeholder}
          autoFocus={autoFocus}
          minRows={1}
          maxRows={8}
          maxLength={2000}
          className="py-2.5"
        />
      </label>
    );
  }
  const whatKey = `${field.key}_what`;
  return (
    <div>
      <span className={labelClass}>{field.label}</span>
      <div role="group" aria-label={field.label} className="flex gap-1.5 px-1">
        {(["yes", "no"] as const).map((answer) => (
          <button
            key={answer}
            type="button"
            aria-pressed={value === answer}
            onClick={() => onValue(field.key, value === answer ? "" : answer)}
            className={cn(
              CHIP,
              "h-8 px-3.5 text-[0.82rem]",
              value === answer ? cn("bg-fg/8 text-fg", CHIP_ON) : CHIP_IDLE,
            )}
          >
            {answer === "yes" ? "Yes" : "No"}
          </button>
        ))}
      </div>
      {value && <p className="mt-1.5 px-1 text-xs text-faint">{value === "yes" ? field.yes : field.no}</p>}
      {value === "yes" && (
        <AutoTextarea
          value={values[whatKey] ?? ""}
          onChange={(e) => onValue(whatKey, e.target.value)}
          placeholder="What?"
          aria-label="What is left to do"
          minRows={1}
          maxRows={6}
          maxLength={2000}
          className="mt-2 py-2.5"
        />
      )}
    </div>
  );
}

function DoneEntry({
  template,
  entry,
  onReopen,
  onRemove,
}: {
  template: NoteTemplate;
  entry: TemplateEntry;
  onReopen: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-t border-line first:border-t-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center gap-2.5 py-2 text-left text-sm"
      >
        <span className="min-w-0 flex-1 truncate">{entryLabel(template, entry) || `A ${template.entry}`}</span>
        <span className={cn("shrink-0 text-xs font-medium", DONE_TONE.text)}>
          {formatDayMonthShort(new Date(entry.done_at!))}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2.5 pb-3 text-sm">
          {template.fields.map((field) => {
            const value = (entry.values[field.key] ?? "").trim();
            if (!value) return null;
            const what = (entry.values[`${field.key}_what`] ?? "").trim();
            const answer = field.kind === "yesno" ? (value === "yes" ? `Yes${what ? ` – ${what}` : ""}` : "No") : value;
            return (
              <div key={field.key}>
                <p className="text-xs font-medium text-faint">{field.label}</p>
                <p className="[overflow-wrap:anywhere] whitespace-pre-line">{answer}</p>
              </div>
            );
          })}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onReopen}>
              <RotateCcw /> Open again
            </Button>
            <Button variant="ghost" size="sm" onClick={onRemove} className="text-muted">
              <Trash2 /> Remove
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
