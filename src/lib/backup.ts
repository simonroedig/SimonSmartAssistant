/**
 * A backup of everything as one JSON file: every table of the app with all of the
 * user's rows (notes in the trash and the vault too, when it is open). Enough to fill a
 * new Supabase project again. Downloaded in the browser – nothing leaves for elsewhere.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/** All of the app's tables, the ones others point to first (as a restore needs them). */
export const BACKUP_TABLES = [
  "user_settings",
  "note_categories",
  "notes",
  "todos",
  "plan_blocks",
  "day_notes",
  "shopping_items",
  "shopping_history",
  "birthdays",
  "media_titles",
  "blocked_apps",
  "briefing_settings",
  "briefings",
] as const satisfies readonly (keyof Database["public"]["Tables"])[];

export type BackupTable = (typeof BACKUP_TABLES)[number];

export type Backup = {
  app: "smart-assistant";
  version: 1;
  exported_at: string;
  /** Whether the vault's notes are in it (only when it was open). */
  vault_included: boolean;
  tables: Record<BackupTable, Record<string, unknown>[]>;
};

const PAGE = 1000;

export async function collectBackup(
  supabase: SupabaseClient<Database>,
  vaultIncluded: boolean,
  now = new Date(),
): Promise<Backup> {
  const tables = {} as Backup["tables"];
  for (const table of BACKUP_TABLES) {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      rows.push(...(data as Record<string, unknown>[]));
      if (data.length < PAGE) break;
    }
    tables[table] = rows;
  }
  return { app: "smart-assistant", version: 1, exported_at: now.toISOString(), vault_included: vaultIncluded, tables };
}

export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `smart-assistant-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/** A line about what's in it, e.g. "42 notes, 3 categories, 120 plan blocks …". */
export function backupSummary(backup: Backup): string {
  const t = backup.tables;
  const parts: [number, string][] = [
    [t.notes.length, "notes"],
    [t.todos.length, "backlog items"],
    [t.plan_blocks.length, "plan blocks"],
    [t.shopping_items.length, "shopping items"],
    [t.birthdays.length, "birthdays"],
    [t.media_titles.length, "titles"],
  ];
  return parts.map(([n, what]) => `${n} ${what}`).join(" · ");
}

/** Hands the file to the browser as a download. */
export function downloadJson(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
