/**
 * Notes from a template: one note holds a list of entries with fixed fields, and
 * each entry can be checked off. The first template, "Let go", walks a situation
 * that keeps replaying through four questions – then it is done with.
 */

export type TemplateId = "letgo";

export type TemplateField =
  | { key: string; kind: "text"; label: string; placeholder?: string }
  /** Yes or no; "yes" asks for a few words more (stored under `${key}_what`). */
  | { key: string; kind: "yesno"; label: string; yes: string; no: string };

export type NoteTemplate = {
  id: TemplateId;
  name: string;
  /** One line in the template picker. */
  description: string;
  /** One entry ("situation"). */
  entry: string;
  fields: TemplateField[];
  /** The button that checks an entry off, and how a done entry says so. */
  doneAction: string;
  doneLabel: string;
};

export const NOTE_TEMPLATES: Record<TemplateId, NoteTemplate> = {
  letgo: {
    id: "letgo",
    name: "Let go",
    description: "For a moment that keeps replaying – four questions, then check it off.",
    entry: "situation",
    fields: [
      { key: "situation", kind: "text", label: "What happened?", placeholder: "The situation, in a few words" },
      {
        key: "todo",
        kind: "yesno",
        label: "Is there anything left to do?",
        yes: "Yes – then do it, or plan when",
        no: "No – then it's only going round in circles",
      },
      { key: "worst", kind: "text", label: "Realistically, the worst that comes of it" },
      { key: "next", kind: "text", label: "Next time I'd do differently (if anything)" },
      { key: "friend", kind: "text", label: "What would I tell a friend?" },
    ],
    doneAction: "Let it go",
    doneLabel: "Let go",
  },
};

export const TEMPLATE_IDS = Object.keys(NOTE_TEMPLATES) as TemplateId[];

export function noteTemplate(id: string | null | undefined): NoteTemplate | null {
  return id && id in NOTE_TEMPLATES ? NOTE_TEMPLATES[id as TemplateId] : null;
}

export type TemplateEntry = {
  id: string;
  /** When it was added (ISO). */
  at: string;
  values: Record<string, string>;
  /** Checked off (ISO), or still open. */
  done_at: string | null;
};

/** Entries as stored (anything odd is dropped). */
export function readEntries(raw: unknown): TemplateEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((e) => {
    if (!e || typeof e !== "object") return [];
    const { id, at, values, done_at } = e as Record<string, unknown>;
    if (typeof id !== "string" || typeof at !== "string") return [];
    const clean: Record<string, string> = {};
    if (values && typeof values === "object") {
      for (const [k, v] of Object.entries(values)) if (typeof v === "string") clean[k] = v;
    }
    return [{ id, at, values: clean, done_at: typeof done_at === "string" ? done_at : null }];
  });
}

export function isEntryEmpty(entry: TemplateEntry): boolean {
  return Object.values(entry.values).every((v) => !v.trim());
}

/** Open ones first (newest on top), then the checked-off ones (last checked off on top). */
export function sortEntries(entries: TemplateEntry[]): { open: TemplateEntry[]; done: TemplateEntry[] } {
  const open = entries.filter((e) => !e.done_at).sort((a, b) => b.at.localeCompare(a.at));
  const done = entries.filter((e) => e.done_at).sort((a, b) => b.done_at!.localeCompare(a.done_at!));
  return { open, done };
}

/** A short name for an entry: its first field, first line. */
export function entryLabel(template: NoteTemplate, entry: TemplateEntry): string {
  const first = template.fields[0];
  return (entry.values[first.key] ?? "").trim().split("\n")[0] ?? "";
}

/**
 * The entries as plain text (the note's body): each one with its answers, and when it
 * was checked off. `formatDay` keeps the dates in the app's format.
 */
export function entriesToText(
  template: NoteTemplate,
  entries: TemplateEntry[],
  formatDay: (date: Date) => string,
): string {
  const { open, done } = sortEntries(entries.filter((e) => !isEntryEmpty(e)));
  return [...open, ...done]
    .map((entry) => {
      const lines: string[] = [];
      for (const field of template.fields) {
        const value = (entry.values[field.key] ?? "").trim();
        if (field.kind === "yesno") {
          if (!value) continue;
          const what = (entry.values[`${field.key}_what`] ?? "").trim();
          const answer = value === "yes" ? `Yes${what ? `: ${what}` : ""}` : "No";
          lines.push(`${field.label} ${answer}`);
        } else if (value) {
          lines.push(`${field.label}\n${value}`);
        }
      }
      if (entry.done_at) lines.push(`✅ ${template.doneLabel} on ${formatDay(new Date(entry.done_at))}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

/** What a note from a template stores: its entries, and their text as its body. */
export function templateContent(
  template: NoteTemplate,
  entries: TemplateEntry[],
  formatDay: (date: Date) => string,
): { entries: TemplateEntry[]; body: string } {
  const kept = entries.filter((e) => e.done_at || !isEntryEmpty(e));
  return { entries: kept, body: entriesToText(template, kept, formatDay).slice(0, 20000) };
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  januar: 1,
  january: 1,
  feb: 2,
  februar: 2,
  february: 2,
  mär: 3,
  märz: 3,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  mai: 5,
  may: 5,
  jun: 6,
  juni: 6,
  june: 6,
  jul: 7,
  juli: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  okt: 10,
  oct: 10,
  oktober: 10,
  october: 10,
  nov: 11,
  november: 11,
  dez: 12,
  dec: 12,
  dezember: 12,
  december: 12,
};

/** "10. Nov", "10 November 2026", "10.11.", "10.11.2026" – the year from `now` (never in the future). */
function readDay(text: string, now: Date): Date | null {
  const m =
    /(\d{1,2})\.?\s*([A-Za-zÄÖÜäöü]{3,9})\.?(?:\s*(\d{4}))?/.exec(text) ?? /(\d{1,2})\.(\d{1,2})\.(\d{4})?/.exec(text);
  if (!m) return null;
  const month = /^\d+$/.test(m[2]) ? Number(m[2]) : MONTH_NAMES[m[2].toLowerCase()];
  if (!month || month > 12) return null;
  let year = m[3] ? Number(m[3]) : now.getFullYear();
  let date = new Date(year, month - 1, Number(m[1]), 12);
  if (!m[3] && date.getTime() > now.getTime() + 86_400_000) date = new Date(--year, month - 1, Number(m[1]), 12);
  return date.getMonth() === month - 1 ? date : null;
}

/**
 * Entries from text written by hand in the template's shape: each starts with a line
 * naming the first field ("Situation:"), the other fields follow as "1." … "4.", and
 * "✅ … 10. Nov" marks one as done. Lines may start with "- ".
 */
export function parseTemplateText(template: NoteTemplate, text: string, now = new Date()): TemplateEntry[] {
  const [first, ...rest] = template.fields;
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const entries: TemplateEntry[] = [];
  let current: { values: Record<string, string[]>; done: Date | null } | null = null;
  let field: string | null = null;
  const startWord = /^\s*(situation|was ist passiert|what happened)\b\s*\??:?\s*(.*)$/i;

  const finish = () => {
    if (!current) return;
    const values: Record<string, string> = {};
    for (const [key, list] of Object.entries(current.values)) {
      const kept = list.map((l) => l.trim()).filter(Boolean);
      if (kept.length) values[key] = kept.join("\n");
    }
    for (const f of rest) {
      if (f.kind !== "yesno" || !values[f.key]) continue;
      const answer = values[f.key]
        .split("\n")[0]
        .replace(/^(ja|yes)\s*:\s*/i, "")
        .trim();
      const no = !answer || /^(nein|nope|no|nö|ne|nix|nichts)\b/i.test(answer);
      values[f.key] = no ? "no" : "yes";
      if (!no) values[`${f.key}_what`] = answer;
    }
    const at = (current.done ?? now).toISOString();
    if (Object.keys(values).length) {
      entries.push({
        id: `imported-${entries.length}-${at}`,
        at,
        values,
        done_at: current.done ? current.done.toISOString() : null,
      });
    }
    current = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/^\s*[-•*]\s*/, "").trimEnd();
    const start = startWord.exec(raw.replace(/^\s*[-•*]\s*/, ""));
    if (start) {
      finish();
      current = { values: { [first.key]: start[2] ? [start[2]] : [] }, done: null };
      field = first.key;
      continue;
    }
    if (!current) continue;
    if (/✅|✔|abgehakt|let go on|done on/i.test(line)) {
      current.done = readDay(line, now) ?? now;
      field = null;
      continue;
    }
    const numbered = /^\s*(\d)[.)]\s*(.*)$/.exec(line);
    if (numbered && rest[Number(numbered[1]) - 1]) {
      field = rest[Number(numbered[1]) - 1].key;
      current.values[field] = [];
      continue;
    }
    if (field && line.trim()) current.values[field].push(line.trim());
  }
  finish();
  // Real ids for the entries (the text gave none).
  return entries.map((e, i) => ({
    ...e,
    id: `${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 8)}`,
  }));
}
