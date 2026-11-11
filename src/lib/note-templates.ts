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
