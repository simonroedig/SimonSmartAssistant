"use client";

import { AlertTriangle, Download, Globe, House, RefreshCw, Search, ShieldBan, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Row, Section } from "@/components/settings/section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useDevicePrefs } from "@/hooks/use-device-prefs";
import { latestLauncherVersion, launcher, refreshFilter, useIsLauncher, useLauncherState } from "@/lib/launcher";
import { FIELD_FOCUS } from "@/lib/tones";
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
      className={cn("flex items-center gap-2", FIELD_FOCUS.quiet, className)}
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
          className="field h-12 w-full rounded-2xl border border-line bg-surface-strong pr-4 pl-11 text-[0.95rem] shadow-(--shadow-card) outline-none placeholder:text-faint focus:border-(--field-focus)"
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

/** How long ago (in words), for the block list's last update. */
function sinceLabel(ms: number): string {
  if (!ms) return "never";
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 90) return "just now";
  const m = Math.round(s / 60);
  if (m < 90) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

/**
 * Settings: the NSFW filter. It runs in the launcher app as an accessibility
 * service that watches only the browsers and blocks adult sites and searches
 * against a list kept on the phone. Everything is matched on the device; what's
 * opened or searched is never sent anywhere. The switch opens the system's
 * accessibility settings, where Android asks for the permission by hand.
 */
export function ContentFilterSection() {
  const isLauncher = useIsLauncher();
  const { features, filter } = useLauncherState();

  // Checked each time the settings open and on coming back (e.g. from the system settings).
  useEffect(() => {
    if (!isLauncher) return;
    void refreshFilter();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshFilter();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isLauncher]);

  if (!isLauncher || !features.includes("filter")) return null;

  const on = filter?.enabled === true;
  const count = filter?.count ?? 0;
  const failed = !!filter?.error && count === 0;

  return (
    <Section
      icon={<ShieldBan />}
      title="NSFW filter"
      description="Blocks adult sites and searches in your browser. Everything is checked on the phone – nothing you open or search is ever sent anywhere."
    >
      <Row
        label={on ? "On" : "Off"}
        hint={
          on
            ? "Turn it off in the phone's accessibility settings."
            : "Turning it on opens the accessibility settings. Allow “restricted settings” first if Android asks."
        }
      >
        <Button variant={on ? "secondary" : "primary"} size="sm" onClick={() => void launcher.openFilterSettings()}>
          {on ? "Open settings" : "Turn on"}
        </Button>
      </Row>
      <Row
        label="Block list"
        hint={
          filter === null
            ? "…"
            : failed
              ? "Couldn't download the list yet."
              : count > 0
                ? `${count.toLocaleString("en")} sites · updated ${sinceLabel(filter.updatedAt)}`
                : "Downloads when the filter is on."
        }
      >
        <span className="flex items-center gap-2">
          {filter?.error && count > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-3.5" /> Update failed
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={filter?.fetching}
            onClick={() => void launcher.refreshFilterList().then(() => window.setTimeout(refreshFilter, 1500))}
          >
            <RefreshCw className={cn(filter?.fetching && "animate-spin")} /> Update
          </Button>
        </span>
      </Row>
    </Section>
  );
}

/** Settings: the Android launcher – get it, or its version and updates when running in it. */
export function LauncherSection() {
  const isLauncher = useIsLauncher();
  const { latest, available, status } = useLauncherUpdate();
  const { versionName, features } = useLauncherState();
  const [device, setDevice] = useDevicePrefs();
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
          {features.includes("recent") && (
            <Row
              label="Recently used apps"
              hint="A button next to the apps search shows the apps you used last. Android doesn't tell other apps which ones are still open."
            >
              <Switch
                checked={device.recentApps}
                onCheckedChange={(recentApps) => setDevice({ recentApps })}
                label="Recently used apps"
              />
            </Row>
          )}
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
