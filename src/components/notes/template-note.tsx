"use client";

import { Check, ClipboardPaste, RotateCcw, Trash2, Wind } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CHIP, CHIP_IDLE, CHIP_ON } from "@/components/ui/chip";
import { Fab } from "@/components/ui/fab";
import { AutoTextarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { newId, type Note, nowIso } from "@/data/core";
import { formatDayMonthShort } from "@/lib/date";
import {
  entryLabel,
  isEntryEmpty,
  type NoteTemplate,
  parseTemplateText,
  readEntries,
  sortEntries,
  type TemplateEntry,
  type TemplateField,
  type TemplateId,
} from "@/lib/note-templates";
import { FIELD_FOCUS, TONE_STYLES } from "@/lib/tones";
import { cn } from "@/lib/utils";

/** A template's collection, and what's checked off in it – in green, like done to-dos. */
export const TEMPLATE_TONE = TONE_STYLES.emerald;

const ICONS: Record<TemplateId, typeof Wind> = { letgo: Wind };

/** Diagonal stripes: a template's collection looks different from a category. */
export const TEMPLATE_PATTERN =
  "border border-dashed border-emerald-500/35 bg-emerald-500/8 bg-[repeating-linear-gradient(135deg,transparent_0_9px,rgb(16_185_129/0.09)_9px_18px)] dark:border-emerald-300/30";

export function TemplateIcon({ template, className }: { template: NoteTemplate; className?: string }) {
  const Icon = ICONS[template.id];
  return <Icon className={className} />;
}

function newEntry(): TemplateEntry {
  return { id: newId(), at: nowIso(), values: {}, done_at: null };
}

/** In the notes overview: the collection as a tile – striped – with a peek at what's open. */
export function TemplateTile({ template, note, onOpen }: { template: NoteTemplate; note: Note; onOpen: () => void }) {
  const { open, done } = sortEntries(readEntries(note.entries).filter((e) => !isEntryEmpty(e)));
  const peek = (open.length ? open : done).slice(0, 3);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${template.name}, ${open.length} open, ${done.length} ${template.doneLabel.toLowerCase()}`}
      className={cn(
        "flex h-full min-h-28 w-full flex-col gap-2 rounded-2xl px-3.5 py-3 text-left transition-[filter] hover:brightness-[1.03] active:brightness-95",
        TEMPLATE_PATTERN,
      )}
    >
      <span className={cn("flex items-center gap-2 font-semibold", TEMPLATE_TONE.text)}>
        <TemplateIcon template={template} className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{template.name}</span>
        {open.length > 0 && (
          <span className="rounded-full bg-emerald-500/18 px-1.5 text-xs font-semibold tabular-nums">
            {open.length}
          </span>
        )}
      </span>
      {peek.length === 0 ? (
        <span className="text-sm text-faint">Nothing on your mind</span>
      ) : (
        <span className="flex flex-col gap-1">
          {peek.map((entry) => (
            <span key={entry.id} className="flex items-center gap-1.5 text-[0.85rem] leading-snug text-fg/80">
              {entry.done_at ? (
                <Check className={cn("size-3 shrink-0", TEMPLATE_TONE.text)} strokeWidth={3} />
              ) : (
                <span className="size-1 shrink-0 rounded-full bg-current opacity-40" />
              )}
              <span className="min-w-0 truncate">{entryLabel(template, entry) || `A ${template.entry}`}</span>
            </span>
          ))}
          {!open.length && done.length > peek.length && (
            <span className="text-xs text-faint">
              {done.length} {template.doneLabel.toLowerCase()}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

type EntrySheetState = { entry: TemplateEntry; isNew: boolean } | null;

/**
 * Inside a template's collection: + for a new entry (the questions in a sheet), the open
 * ones on top – a tap on the circle checks one off – and everything checked off below.
 */
export function TemplateView({
  template,
  note,
  onChange,
  importing,
  onImportClose,
}: {
  template: NoteTemplate;
  note: Note;
  /** The entries changed (saved by the caller, with their text). */
  onChange: (entries: TemplateEntry[]) => void;
  importing: boolean;
  onImportClose: () => void;
}) {
  const entries = readEntries(note.entries);
  const { open, done } = sortEntries(entries.filter((e) => !isEntryEmpty(e)));
  const [sheet, setSheet] = useState<EntrySheetState>(null);

  const put = (entry: TemplateEntry) =>
    onChange(
      entries.some((e) => e.id === entry.id)
        ? entries.map((e) => (e.id === entry.id ? entry : e))
        : [...entries, entry],
    );
  const remove = (id: string) => onChange(entries.filter((e) => e.id !== id));
  const letGo = (entry: TemplateEntry) => {
    put({ ...entry, done_at: nowIso() });
    toast(`${template.doneLabel} – one less on your mind`, {
      icon: <Check className={cn("size-4", TEMPLATE_TONE.text)} />,
      action: { label: "Undo", onClick: () => put({ ...entry, done_at: null }) },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="px-1 text-sm text-muted">{template.description}</p>

      <section>
        <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-faint uppercase">Open</h2>
        {open.length === 0 ? (
          <p className="rounded-2xl px-4 py-3 text-sm text-muted well">
            Nothing open. When a moment keeps replaying, tap + and walk it through.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence initial={false}>
              {open.map((entry) => (
                <motion.li
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
                  className="flex items-start gap-1 rounded-2xl paper"
                >
                  <button
                    type="button"
                    aria-label={`${template.doneAction}: ${entryLabel(template, entry)}`}
                    title={template.doneAction}
                    onClick={() => letGo(entry)}
                    className="grid size-12 shrink-0 place-items-center rounded-2xl text-faint transition-colors hover:text-emerald-600 dark:hover:text-emerald-300"
                  >
                    <span className="grid size-5.5 place-items-center rounded-full border-2 border-current" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheet({ entry, isNew: false })}
                    className="min-w-0 flex-1 py-3 pr-4 text-left"
                  >
                    <span className="line-clamp-2 font-medium [overflow-wrap:anywhere]">
                      {entryLabel(template, entry) || `A ${template.entry}`}
                    </span>
                    <span className="text-xs text-faint">{formatDayMonthShort(new Date(entry.at))}</span>
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h2
            className={cn(
              "mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold tracking-wide uppercase",
              TEMPLATE_TONE.text,
            )}
          >
            <Check className="size-3.5" strokeWidth={3} /> {template.doneLabel} · {done.length}
          </h2>
          <ul className="flex flex-col overflow-hidden rounded-2xl paper">
            {done.map((entry) => (
              <li key={entry.id} className="border-t border-line first:border-t-0">
                <button
                  type="button"
                  onClick={() => setSheet({ entry, isNew: false })}
                  className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-hover"
                >
                  <Check className={cn("size-4 shrink-0", TEMPLATE_TONE.text)} strokeWidth={3} />
                  <span className="min-w-0 flex-1 truncate text-muted">
                    {entryLabel(template, entry) || `A ${template.entry}`}
                  </span>
                  <span className="shrink-0 text-xs text-faint tabular-nums">
                    {formatDayMonthShort(new Date(entry.done_at!))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Fab
        aria-label={`New ${template.entry}`}
        onClick={() => setSheet({ entry: newEntry(), isNew: true })}
        className={cn(
          "max-md:absolute max-md:right-[calc(1rem+1px)] max-md:bottom-[calc(1rem+1px)] md:fixed md:right-[calc(2*var(--gutter))] md:bottom-[calc(2*var(--gutter))]",
          TEMPLATE_TONE.solid,
        )}
      />

      <EntrySheet
        template={template}
        state={sheet}
        onClose={() => setSheet(null)}
        onSave={put}
        onRemove={remove}
        onLetGo={letGo}
      />
      <ImportSheet
        template={template}
        open={importing}
        onClose={onImportClose}
        onImport={(found) => onChange([...entries, ...found])}
      />
    </div>
  );
}

function EntrySheet({
  template,
  state,
  onClose,
  onSave,
  onRemove,
  onLetGo,
}: {
  template: NoteTemplate;
  state: EntrySheetState;
  onClose: () => void;
  onSave: (entry: TemplateEntry) => void;
  onRemove: (id: string) => void;
  onLetGo: (entry: TemplateEntry) => void;
}) {
  // A fresh form per opening, kept while the sheet animates out.
  const [shown, setShown] = useState({ state, count: 0 });
  if (state && state !== shown.state) setShown({ state, count: shown.count + 1 });
  if (!shown.state) return null;
  return (
    <EntryForm
      key={shown.count}
      template={template}
      entry={shown.state.entry}
      isNew={shown.state.isNew}
      open={state !== null}
      {...{ onClose, onSave, onRemove, onLetGo }}
    />
  );
}

function EntryForm({
  template,
  entry,
  isNew,
  open,
  onClose,
  onSave,
  onRemove,
  onLetGo,
}: {
  template: NoteTemplate;
  entry: TemplateEntry;
  isNew: boolean;
  open: boolean;
  onClose: () => void;
  onSave: (entry: TemplateEntry) => void;
  onRemove: (id: string) => void;
  onLetGo: (entry: TemplateEntry) => void;
}) {
  const [values, setValues] = useState(entry.values);
  const [handled, setHandled] = useState(false);
  const current = { ...entry, values };
  const empty = isEntryEmpty(current);
  const changed = JSON.stringify(values) !== JSON.stringify(entry.values);

  // Closing in any way saves (an empty new one is just dropped).
  const close = () => {
    if (!open) return;
    if (!handled && !empty && changed) onSave(current);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && close()}
      title={isNew ? `New ${template.entry}` : entry.done_at ? template.doneLabel : template.name}
      description={
        entry.done_at
          ? `${template.doneLabel} on ${formatDayMonthShort(new Date(entry.done_at))}`
          : isNew
            ? undefined
            : `Added on ${formatDayMonthShort(new Date(entry.at))}`
      }
      className={FIELD_FOCUS.emerald}
      size="half"
      footer={
        <>
          {!isNew && (
            <Button
              variant="danger"
              size="icon"
              aria-label={`Remove this ${template.entry}`}
              onClick={() => {
                setHandled(true);
                onRemove(entry.id);
                onClose();
              }}
            >
              <Trash2 />
            </Button>
          )}
          {entry.done_at ? (
            <Button
              variant="secondary"
              onClick={() => {
                setHandled(true);
                onSave({ ...current, done_at: null });
                onClose();
              }}
            >
              <RotateCcw /> Open again
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={empty}
              onClick={() => {
                setHandled(true);
                onLetGo(current);
                onClose();
              }}
              className={cn("ui-action shadow-none", TEMPLATE_TONE.solid)}
            >
              <Check strokeWidth={2.6} /> {template.doneAction}
            </Button>
          )}
          <Button variant="ghost" className="ml-auto" onClick={close}>
            {empty && isNew ? "Cancel" : "Done"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {template.fields.map((field, i) => (
          <Field
            key={field.key}
            field={field}
            values={values}
            autoFocus={isNew && i === 0}
            onValue={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
          />
        ))}
      </div>
    </Sheet>
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
  const labelClass = "mb-1.5 block px-1 text-[0.85rem] font-medium text-muted";
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
              "h-9 px-4 text-[0.85rem]",
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

/** Entries written by hand elsewhere (e.g. an older note), pasted in. */
function ImportSheet({
  template,
  open,
  onClose,
  onImport,
}: {
  template: NoteTemplate;
  open: boolean;
  onClose: () => void;
  onImport: (entries: TemplateEntry[]) => void;
}) {
  const [text, setText] = useState("");
  const found = parseTemplateText(template, text);
  const close = () => {
    setText("");
    onClose();
  };
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && close()}
      title="Import"
      description={`Paste ${template.entry}s you wrote down elsewhere – each starting with “Situation:”, the questions as 1. to 4., and “✅ … 10 Nov” for ones already let go.`}
      className={FIELD_FOCUS.emerald}
      size="half"
      footer={
        <Button
          variant="primary"
          disabled={found.length === 0}
          className={cn("ui-action ml-auto shadow-none", TEMPLATE_TONE.solid)}
          onClick={() => {
            onImport(found);
            toast(`Imported ${found.length} ${found.length === 1 ? template.entry : `${template.entry}s`}`);
            close();
          }}
        >
          <ClipboardPaste /> Import {found.length > 0 ? found.length : ""}
        </Button>
      }
    >
      <AutoTextarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Text to import"
        placeholder={"Situation:\n- …\n\n1. Is there anything left to do?\n- No\n…\n\n✅ Let go on 10 Nov"}
        minRows={10}
        maxRows={Number.POSITIVE_INFINITY}
        maxLength={60000}
        className="text-sm"
      />
    </Sheet>
  );
}
