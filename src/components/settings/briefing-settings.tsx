"use client";

import { Check, ChevronDown, Copy, KeyRound, Newspaper } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AutoTextarea, Label } from "@/components/ui/input";
import { makeBriefingKey, useBriefingSettings, useSaveBriefingPrompt } from "@/data/briefings";
import { describeError } from "@/data/core";
import { BRIEFING_KEY_HEADER, BRIEFING_TASK_PROMPT } from "@/lib/briefing";
import { formatNumericDate } from "@/lib/date";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";
import { FIELD_FOCUS } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { Section } from "./section";

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${what} copied`);
  } catch {
    toast.error("Couldn't copy – select it and copy by hand");
  }
}

/** A value to put into Claude's settings, with a copy button. */
function CopyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted">{label}</p>
      <div className="flex items-start gap-2 rounded-xl px-3 py-2 well">
        <code
          className={cn(
            "min-w-0 flex-1 text-xs leading-relaxed break-all select-all",
            multiline && "break-words whitespace-pre-wrap",
          )}
        >
          {value}
        </code>
        <button
          type="button"
          aria-label={`Copy ${label}`}
          onClick={() => void copy(value, label)}
          className="-my-1 -mr-1.5 grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-fg"
        >
          <Copy className="size-4" />
        </button>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sky-500/14 text-xs font-semibold text-sky-700 dark:text-sky-200">
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="font-medium">{title}</p>
        {children}
      </div>
    </li>
  );
}

/**
 * Daily briefing: the prompt the scheduled Claude task is given each morning, the key it
 * hands its briefing in with, and what to set up in Claude.
 */
export function BriefingSection() {
  const settings = useBriefingSettings();
  const save = useSaveBriefingPrompt();
  const row = settings.data ?? null;
  const [prompt, setPrompt] = useState<string | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [sure, setSure] = useState(false);

  const newKey = async () => {
    setMaking(true);
    try {
      setKey(await makeBriefingKey());
      setSure(false);
      void settings.refetch();
    } catch (error) {
      toast.error("Couldn't make a key", { description: describeError(error) });
    } finally {
      setMaking(false);
    }
  };

  const commitPrompt = () => {
    if (!row || prompt === null) return;
    const next = prompt.trim();
    if (!next) {
      setPrompt(null);
      return;
    }
    if (next !== row.prompt) {
      save.mutate({ userId: row.user_id, prompt: next });
      toast("Prompt saved – used from the next run");
    }
    // Typing is local until here; otherwise a change from another screen shows.
    setPrompt(null);
  };

  const host = (() => {
    try {
      return new URL(SUPABASE_URL).hostname;
    } catch {
      return SUPABASE_URL;
    }
  })();

  return (
    <div id="briefing" className="scroll-mt-6">
      <Section
        icon={<Newspaper />}
        title="Daily briefing"
        description="Written each morning by a scheduled Claude task, shown on Home."
      >
        {settings.isPending ? (
          <div className="skeleton h-24 rounded-xl" />
        ) : !row ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted">
              Claude researches the news each morning and hands the briefing in here. It runs in your Claude
              subscription (no API costs) and only gets a key that can do nothing but hand in briefings.
            </p>
            <Button variant="primary" onClick={() => void newKey()} disabled={making}>
              <KeyRound /> {making ? "Setting up…" : "Set up"}
            </Button>
          </div>
        ) : (
          <div className={cn("flex flex-col gap-5", FIELD_FOCUS.sky)}>
            <div>
              <Label htmlFor="briefing-prompt">Prompt</Label>
              <AutoTextarea
                id="briefing-prompt"
                value={prompt ?? row.prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onBlur={commitPrompt}
                minRows={4}
                maxRows={14}
                maxLength={20000}
                className="text-sm"
              />
              <p className="mt-1.5 px-1 text-xs text-faint">
                {"{{WOCHENTAG}}, {{DATUM}} and {{UHRZEIT}}"} become the day, date and time of the run. Each briefing
                keeps the prompt it was made with.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">Key for the scheduled task</p>
                <p className="text-sm text-muted">
                  {row.key_created_at ? `Made on ${formatNumericDate(new Date(row.key_created_at))}` : "None yet"}
                </p>
              </div>
              {sure ? (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setSure(false)}>
                    Keep it
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => void newKey()} disabled={making}>
                    New key – the old one stops
                  </Button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => (row.key_created_at ? setSure(true) : void newKey())}
                >
                  <KeyRound /> New key
                </Button>
              )}
            </div>

            {key && (
              <div className="flex flex-col gap-2 rounded-2xl bg-sky-500/10 p-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Check className="size-4 text-sky-600 dark:text-sky-300" /> Your key – shown only now
                </p>
                <CopyField label="Briefing key" value={key} />
                <p className="text-xs text-muted">
                  Put it into the Briefing environment in Claude as a network secret (step 1 below). Nobody can read it
                  back – if it&apos;s lost, make a new one.
                </p>
              </div>
            )}

            <details className="group rounded-2xl px-4 py-3 well" open={!!key}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-medium">
                Set up in Claude
                <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <ol className="mt-4 flex flex-col gap-5 text-sm">
                <Step n={1} title="An environment for it (claude.ai/code → environment menu → Add environment)">
                  <p className="text-muted">
                    Name it “Briefing”. Network access: Trusted, and add the address below under allowed domains.
                    Environment variables: the two lines below. Network secrets: the key, for that address, in the
                    header below.
                  </p>
                  <CopyField label="Allowed domain / secret's host" value={host} />
                  <CopyField
                    label="Environment variables"
                    value={`BRIEFING_SUPABASE_URL=${SUPABASE_URL}\nBRIEFING_SUPABASE_KEY=${SUPABASE_PUBLISHABLE_KEY}`}
                    multiline
                  />
                  <CopyField label="Secret's header" value={BRIEFING_KEY_HEADER} />
                </Step>
                <Step n={2} title="The scheduled task (claude.ai → Scheduled → New)">
                  <p className="text-muted">
                    Name “Daily briefing”, daily at e.g. 7:43, repository SimonSmartAssistant, the Briefing environment,
                    model Sonnet. Instructions:
                  </p>
                  <CopyField label="Instructions" value={BRIEFING_TASK_PROMPT} multiline />
                </Step>
                <Step n={3} title="Try it">
                  <p className="text-muted">
                    “Run now” in Scheduled – a few minutes later the briefing is on Home. The prompt itself is changed
                    here, not in Claude.
                  </p>
                </Step>
              </ol>
            </details>
          </div>
        )}
      </Section>
    </div>
  );
}
