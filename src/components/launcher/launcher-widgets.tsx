"use client";

import { AlertTriangle, Ban, Download, Globe, House, Search, ShieldBan, Smartphone } from "lucide-react";
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

/**
 * Settings: the app filter. Apps you choose are blocked – a self-limit. In the
 * launcher app an accessibility service sends you back to the home screen when a
 * blocked app opens (it reads only which app is in front, nothing inside it);
 * and the Apps list won't open a blocked one. Enforcing other apps needs the
 * accessibility permission, which the switch opens the settings for.
 */
export function BlockedAppsSection() {
  const isLauncher = useIsLauncher();
  const { features, filter, apps } = useLauncherState();
  const [query, setQuery] = useState("");

  // Checked each time the settings open and on coming back (e.g. from the accessibility settings).
  useEffect(() => {
    if (!isLauncher) return;
    void refreshFilter();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshFilter();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isLauncher]);

  if (!isLauncher || !features.includes("appfilter")) return null;

  const on = filter?.enabled === true;
  const blocked = filter?.blocked ?? [];
  const byPackage = new Map((apps ?? []).map((a) => [a.package, a]));
  const blockedApps = blocked.map((pkg) => byPackage.get(pkg) ?? { id: pkg, label: pkg, package: pkg, icon: "" });

  const term = query.trim().toLowerCase();
  const matches = term
    ? (apps ?? []).filter((a) => !blocked.includes(a.package) && a.label.toLowerCase().includes(term)).slice(0, 6)
    : [];

  const block = (pkg: string) => {
    void launcher.setBlockedApps([...blocked, pkg]);
    setQuery("");
  };
  const unblock = (pkg: string) => void launcher.setBlockedApps(blocked.filter((p) => p !== pkg));

  return (
    <Section
      icon={<ShieldBan />}
      title="Blocked apps"
      description="Apps you'd rather stay off. A blocked app sends you back to the home screen and won't open from here. Checked on the phone; nothing about your apps is sent anywhere."
    >
      {blockedApps.length > 0 && (
        <div className="flex flex-col gap-1 pb-1">
          {blockedApps.map((app) => (
            <div key={app.package} className="flex items-center gap-3 py-1.5">
              {app.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={app.icon} alt="" className="size-8 shrink-0 opacity-60 grayscale" draggable={false} />
              ) : (
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-sunken">
                  <Ban className="size-4 text-faint" />
                </span>
              )}
              <span className="min-w-0 flex-1 truncate font-medium">{app.label}</span>
              <Button variant="ghost" size="sm" onClick={() => unblock(app.package)}>
                Unblock
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-line pt-3.5">
        <label className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3.5 size-[18px] text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Add an app to block…"
            aria-label="Add an app to block"
            autoComplete="off"
            className="field h-11 w-full rounded-2xl pr-3 pl-11 text-[0.95rem] outline-none well placeholder:text-faint focus:border-(--field-focus)"
          />
        </label>
        {term && (
          <ul className="mt-2 flex flex-col gap-0.5">
            {matches.length === 0 ? (
              <li className="px-1 py-2 text-sm text-muted">No app called “{query.trim()}”.</li>
            ) : (
              matches.map((app) => (
                <li key={app.package}>
                  <button
                    type="button"
                    onClick={() => block(app.package)}
                    className="flex w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left transition-colors hover:bg-surface-hover"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={app.icon} alt="" className="size-8 shrink-0" draggable={false} />
                    <span className="min-w-0 flex-1 truncate font-medium">{app.label}</span>
                    <Ban className="size-4 shrink-0 text-faint" />
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {blocked.length > 0 && !on && (
        <div className="mt-3.5 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            Blocked apps won&apos;t open from this launcher, but to also send you home when one is opened another way,
            turn on the service in accessibility.
          </span>
          <Button variant="primary" size="sm" onClick={() => void launcher.openFilterSettings()}>
            Turn on
          </Button>
        </div>
      )}
      {on && (
        <p className="mt-3.5 text-sm text-muted">
          Enforced in the background.{" "}
          <button type="button" className="font-medium text-accent" onClick={() => void launcher.openFilterSettings()}>
            Accessibility settings
          </button>
        </p>
      )}
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
