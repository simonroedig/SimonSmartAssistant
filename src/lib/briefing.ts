import { toDayKey } from "./date";
import type { Inline } from "./markdown";

/** What the scheduled task in Claude is told: everything else comes from Settings and the script. */
export const BRIEFING_TASK_PROMPT =
  'Daily briefing for my dashboard. In the SimonSmartAssistant repository, run `node scripts/briefing.mjs prompt` and do exactly what it prints. If anything fails, run `node scripts/briefing.mjs fail "<short reason>"`. Don\'t change, commit or push anything in the repository.';

/** The header the task's environment adds to its requests, with the key. */
export const BRIEFING_KEY_HEADER = "x-briefing-key";

/** By then the morning's briefing should be there (the task runs earlier). */
export const BRIEFING_EXPECTED_BY_HOUR = 10;

type BriefingLike = { status: string; created_at: string; read_at: string | null };

export type BriefingState<T extends BriefingLike> = {
  /** The newest briefing (or a failed run's note), if any. */
  latest: T | null;
  /** The newest is from today. */
  today: boolean;
  /** Today's is there and not opened yet. */
  unread: boolean;
  /** Today's run couldn't finish. */
  failed: boolean;
  /** Nothing came today, though it should have by now. */
  missing: boolean;
};

/** What Home shows about the briefing (`list` newest first). */
export function briefingState<T extends BriefingLike>(list: T[], now: Date): BriefingState<T> {
  const latest = list[0] ?? null;
  const today = !!latest && toDayKey(new Date(latest.created_at)) === toDayKey(now);
  const failed = today && latest!.status === "error";
  return {
    latest,
    today,
    unread: today && !failed && !latest!.read_at,
    failed,
    missing: !today && now.getHours() >= BRIEFING_EXPECTED_BY_HOUR,
  };
}

// --- "Add to planner" ------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 1,
  januar: 1,
  feb: 2,
  februar: 2,
  mär: 3,
  märz: 3,
  mrz: 3,
  apr: 4,
  april: 4,
  mai: 5,
  jun: 6,
  juni: 6,
  jul: 7,
  juli: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  okt: 10,
  oktober: 10,
  nov: 11,
  november: 11,
  dez: 12,
  dezember: 12,
};

// "3.11." / "3.11.2026" / "3. November" at the start, maybe a range ("20.11.–24.12."), then a dash or colon.
const DATED =
  /^\s*(\d{1,2})\.\s*(?:(\d{1,2})\.(\d{4}|\d{2}(?!\d))?|([A-Za-zÄÖÜäöü]{3,9})\.?(?:\s+(\d{4}))?)(?:\s*[–—-]\s*\d{1,2}\.(?:\s*\d{1,2}\.|\s*[A-Za-zÄÖÜäöü]{3,9}\.?)(?:\s*\d{4})?)?\s*(?:[–—:-]\s*)?/;

/** A source link's label ("Quelle", "Source", "mehr") – not part of what happens. */
const SOURCE_LABEL = /^(quelle|quellen|source|sources|mehr|link|more)$/i;

function plain(nodes: Inline[], links: string[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text" || node.type === "code") return node.text;
      const text = plain(node.children, links);
      if (node.type !== "link") return text;
      if (SOURCE_LABEL.test(text.trim()) || text.trim() === node.href) {
        links.push(node.href);
        return "";
      }
      return text;
    })
    .join("");
}

export type DatedItem = { day: string; title: string; source: string | null };

/**
 * A briefing line that starts with a date ("3.11. – US-Midterms"), as a planner entry:
 * the day (the year from when the briefing was written – a date long gone means next
 * year), the rest of the line as its title and the first source link.
 */
export function datedItem(item: Inline[], writtenAt: Date): DatedItem | null {
  const links: string[] = [];
  const text = plain(item, links).replace(/\s+/g, " ").trim();
  const m = DATED.exec(text);
  if (!m) return null;
  const dayOfMonth = Number(m[1]);
  const month = m[2] ? Number(m[2]) : MONTHS[(m[4] ?? "").toLowerCase()];
  if (!month || month > 12 || dayOfMonth < 1 || dayOfMonth > 31) return null;
  const given = m[3] ?? m[5];
  let year = given ? Number(given.length === 2 ? `20${given}` : given) : writtenAt.getFullYear();
  if (!given) {
    const candidate = new Date(year, month - 1, dayOfMonth);
    if (candidate.getTime() < writtenAt.getTime() - 30 * 86_400_000) year += 1;
  }
  const date = new Date(year, month - 1, dayOfMonth);
  if (date.getMonth() !== month - 1) return null;
  const title = text
    .slice(m[0].length)
    .replace(/[\s([]*[)\]]*\s*$/, "")
    .replace(/[\s·,;–—-]+$/, "")
    .trim();
  if (!title) return null;
  return { day: toDayKey(date), title: title.slice(0, 120), source: links[0] ?? null };
}
