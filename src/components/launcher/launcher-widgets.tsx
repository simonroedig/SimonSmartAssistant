"use client";

import { Download, Globe, House, Search, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Row, Section } from "@/components/settings/section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { latestLauncherVersion, launcher, useIsLauncher, useLauncherState } from "@/lib/launcher";
import { cn } from "@/lib/utils";
import { useLauncherUpdate } from "./launcher-sync";

/** Launcher app, home screen: type and search the web in Firefox. */
export function WebSearchBar({ className }: { className?: string }) {
  const isLauncher = useIsLauncher();
  const [query, setQuery] = useState("");
  if (!isLauncher) return null;
  return (
    <form
      role="search"
      className={cn("flex items-center gap-2", className)}
      onSubmit={(e) => {
        e.preventDefault();
        void launcher.search(query);
        setQuery("");
        (document.activeElement as HTMLElement | null)?.blur();
      }}
    >
      <label className="relative flex min-w-0 flex-1 items-center">
        <Search className="pointer-events-none absolute left-4 size-[18px] text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the web"
          aria-label="Search the web"
          enterKeyHint="search"
          autoComplete="off"
          className="field h-12 w-full rounded-2xl border border-line bg-surface-strong pr-4 pl-11 text-[0.95rem] shadow-(--shadow-card) outline-none placeholder:text-faint focus:border-accent/60"
        />
      </label>
      <button
        type="submit"
        aria-label="Search in Firefox"
        onMouseDown={(e) => e.preventDefault()}
        className="ui-action grid size-12 shrink-0 place-items-center rounded-2xl bg-fg text-bg shadow-(--shadow-card)"
      >
        <Globe className="size-5" />
      </button>
    </form>
  );
}

const STATUS_TEXT = {
  idle: null,
  permission: 'Allow "Install unknown apps", then tap Install again.',
  downloading: "Downloading…",
  installing: "Confirm the update to finish.",
  installed: "Updated.",
  failed: "That didn't work – try again.",
} as const;

/** Launcher app, home screen: a newer version of the app is ready. */
export function LauncherUpdateBanner({ className }: { className?: string }) {
  const { available, latest, status } = useLauncherUpdate();
  if (!available || !latest) return null;
  return (
    <Card className={cn("flex-row items-center gap-3 p-3 pl-4", className)}>
      <Download className="size-5 shrink-0 text-accent" />
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-semibold">Launcher update {latest.versionName}</div>
        <div className="text-muted">{STATUS_TEXT[status] ?? "A new version of the app is ready."}</div>
      </div>
      <Button variant="primary" size="sm" disabled={status === "downloading"} onClick={() => void launcher.update()}>
        Install
      </Button>
    </Card>
  );
}

/** Settings: the Android launcher – get it, or its version and updates when running in it. */
export function LauncherSection() {
  const isLauncher = useIsLauncher();
  const { latest, available, status } = useLauncherUpdate();
  const { versionName } = useLauncherState();
  const [published, setPublished] = useState<{ versionName: string } | null>(null);

  useEffect(() => {
    if (isLauncher) return;
    let cancelled = false;
    void latestLauncherVersion().then((found) => {
      if (!cancelled) setPublished(found);
    });
    return () => {
      cancelled = true;
    };
  }, [isLauncher]);

  return (
    <Section
      icon={<Smartphone />}
      title="Android launcher"
      description="Your phone's home screen: this dashboard, with all your apps one tap away."
    >
      {isLauncher ? (
        <>
          <Row label="Installed" hint={available && latest ? `Version ${latest.versionName} is ready` : "Up to date"}>
            <span className="flex items-center gap-2">
              <span className="text-sm text-muted tabular">{versionName || "…"}</span>
              {available && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={status === "downloading"}
                  onClick={() => void launcher.update()}
                >
                  <Download /> Install
                </Button>
              )}
            </span>
          </Row>
          <Row label="Home app" hint="Make this your phone's home screen">
            <Button variant="secondary" size="sm" onClick={() => void launcher.homeSettings()}>
              <House /> Choose
            </Button>
          </Row>
        </>
      ) : published ? (
        <Row label={`Version ${published.versionName}`} hint="Open this on your Android phone to install it">
          <Button asChild variant="secondary" size="sm">
            <a href="/launcher/smart-assistant.apk" download>
              <Download /> Download
            </a>
          </Button>
        </Row>
      ) : (
        <p className="text-sm text-muted">Not published yet – see docs/LAUNCHER.md.</p>
      )}
    </Section>
  );
}
