"use client";

import { DatabaseBackup } from "lucide-react";
import { useState } from "react";
import { VaultPinSheet } from "@/components/notes/vault-pin-sheet";
import { Button } from "@/components/ui/button";
import { useSettings, useSettingsRow, useUpdateSettings } from "@/data/settings";
import { useVaultStatus } from "@/data/vault";
import { useNow } from "@/hooks/use-now";
import { backupFileName, backupSummary, collectBackup, downloadJson } from "@/lib/backup";
import { formatLongDate } from "@/lib/date";
import { useIsLauncher } from "@/lib/launcher";
import { BACKUP_DUE_DAYS, backupDue } from "@/lib/icon-hints";
import { createClient } from "@/lib/supabase/client";
import { isVaultOpen } from "@/lib/vault";
import { Section } from "./section";

/**
 * Everything as one file, to keep somewhere safe – if Supabase or Vercel ever lose it,
 * a new project can be filled from it. Reminds after eight weeks (here and with a dot on
 * Settings in the menu).
 */
export function BackupSection() {
  const { settings, isLoading } = useSettings();
  const row = useSettingsRow();
  const update = useUpdateSettings();
  const vault = useVaultStatus().data;
  const now = useNow();
  const [state, setState] = useState<{ kind: "idle" | "busy" } | { kind: "done" | "failed"; text: string }>({
    kind: "idle",
  });
  const [askPin, setAskPin] = useState(false);
  // The launcher app can't save files – there the backup is made in a browser.
  const launcher = useIsLauncher();

  const lastAt = settings.backup.lastAt;
  const due = now && !isLoading ? backupDue(lastAt, now) : false;

  const run = async () => {
    setState({ kind: "busy" });
    try {
      const at = new Date();
      const backup = await collectBackup(createClient(), isVaultOpen(), at);
      downloadJson(backup, backupFileName(at));
      if (row.data) update.mutate({ current: row.data, backup: { lastAt: at.toISOString() } });
      setState({ kind: "done", text: backupSummary(backup) });
    } catch {
      setState({ kind: "failed", text: "Couldn't make the backup – check the connection and try again." });
    }
  };

  const start = () => {
    // The vault's notes only come along while it is open – never leave them out silently.
    if (vault?.hasPin && !isVaultOpen()) setAskPin(true);
    else void run();
  };

  return (
    <Section
      icon={<DatabaseBackup />}
      title="Backup"
      description="Everything in one file – notes (vault included), planner, backlog, shopping, settings. Keep it somewhere safe, e.g. OneDrive's Personal Vault."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0" aria-live="polite">
          {isLoading || !now ? (
            <div className="skeleton h-5 w-40" />
          ) : (
            <>
              <div className="font-medium">
                {lastAt ? `Last backup: ${formatLongDate(new Date(lastAt))}` : "No backup yet"}
              </div>
              {due && (
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  {lastAt ? `Over ${BACKUP_DUE_DAYS / 7} weeks ago – time for a new one.` : "Time for the first one."}
                </div>
              )}
            </>
          )}
        </div>
        {!launcher && (
          <Button onClick={start} disabled={state.kind === "busy" || isLoading}>
            {state.kind === "busy" ? "Collecting…" : "Download backup"}
          </Button>
        )}
      </div>
      {launcher && (
        <p className="mt-3 text-sm text-muted">{"Download it on your PC or in Chrome – the launcher can't save files."}</p>
      )}
      {state.kind === "done" && <p className="mt-3 text-sm text-muted">Downloaded: {state.text}</p>}
      {state.kind === "failed" && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">{state.text}</p>}
      <VaultPinSheet
        open={askPin}
        mode="unlock"
        onClose={() => setAskPin(false)}
        onDone={() => {
          setAskPin(false);
          void run();
        }}
      />
    </Section>
  );
}
