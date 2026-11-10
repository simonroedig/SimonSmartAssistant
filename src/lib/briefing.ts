import { toDayKey } from "./date";

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
