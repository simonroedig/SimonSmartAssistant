"use client";

import { Globe, History, LayoutGrid, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppLink } from "@/components/shell/app-link";
import { FILL_BODY, FillPage, PageBody, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLongPress } from "@/hooks/use-long-press";
import { type LauncherApp, launcher, refreshRecent, useIsLauncher, useLauncherState } from "@/lib/launcher";
import { FIELD_FOCUS } from "@/lib/tones";
import { cn } from "@/lib/utils";

function AppTile({
  app,
  onOpen,
  compact,
  className,
}: {
  app: LauncherApp;
  onOpen: () => void;
  /** Smaller, one line of name (the strip of apps used last). */
  compact?: boolean;
  className?: string;
}) {
  // Press and hold: the system's app info (to uninstall, permissions, …).
  const longPress = useLongPress(() => void launcher.showInfo(app), 550);
  return (
    <li className={className}>
      <button
        type="button"
        {...longPress.props}
        // Keeps the search field focused: otherwise the first tap only closes the keyboard
        // (the results move with it) and a second tap is needed.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (longPress.wasLongPress()) return;
          onOpen();
          void launcher.open(app);
        }}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "flex w-full flex-col items-center gap-1.5 rounded-2xl px-1 py-2 transition-transform select-none [-webkit-touch-callout:none] active:scale-95",
          compact && "gap-1 py-1.5",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={app.icon} alt="" className={compact ? "size-11" : "size-14"} draggable={false} />
        <span
          className={cn(
            "w-full text-center text-[0.72rem] leading-tight font-medium",
            compact ? "truncate text-[0.68rem]" : "line-clamp-2",
          )}
        >
          {app.label}
        </span>
      </button>
    </li>
  );
}

const RECENT_KEY = "ssa:recent-apps";

function readRecentOpen() {
  try {
    return localStorage.getItem(RECENT_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The apps used last, in a tray above the search (inside the same panel, so it
 * reads as what the button opened): the newest on the right, older ones further
 * left. Tapping one brings it back as you left it. (Previews and closing apps stay
 * with the system's own recents screen – a launcher can't close other apps.)
 */
function RecentTray({ apps, open, onOpen }: { apps: LauncherApp[]; open: boolean; onOpen: () => void }) {
  const { recent } = useLauncherState();

  // Asked when it opens and whenever the launcher comes back – an app has just been used.
  useEffect(() => {
    if (!open) return;
    void refreshRecent();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshRecent();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [open]);

  const shown = useMemo(() => {
    const byPackage = new Map<string, LauncherApp>();
    for (const app of apps) if (!byPackage.has(app.package)) byPackage.set(app.package, app);
    return (recent?.packages ?? []).flatMap((name) => byPackage.get(name) ?? []);
  }, [apps, recent]);

  return (
    // Folds open upwards out of the search bar; closed it takes no room and no taps.
    <div
      inert={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity,visibility] duration-200 ease-out",
        open ? "grid-rows-[1fr]" : "invisible grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="min-h-0 overflow-hidden">
        {/* Swiping sideways scrolls the tray instead of switching the section. */}
        <section aria-label="Recent apps" data-swipe className="mb-2 rounded-2xl well">
          {recent === null ? (
            <div className="flex h-[4.75rem] flex-row-reverse gap-1 overflow-hidden p-1.5">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className="flex w-[4.25rem] shrink-0 flex-col items-center gap-1 py-1.5">
                  <span className="skeleton size-11 rounded-2xl" />
                  <span className="skeleton h-2 w-10" />
                </span>
              ))}
            </div>
          ) : !recent.allowed ? (
            <div className="flex items-center gap-3 py-2.5 pr-2.5 pl-3.5">
              <p className="min-w-0 flex-1 text-sm leading-snug text-muted">
                To see the apps you used last, allow usage access for Smart Assistant.
              </p>
              <Button size="sm" onClick={() => void launcher.allowUsageAccess()}>
                Allow
              </Button>
            </div>
          ) : shown.length === 0 ? (
            <p className="px-3 py-5 text-center text-sm text-muted">The apps you open show up here.</p>
          ) : (
            <ul
              aria-label="Recent apps"
              // Fades out on the left: older apps are further that way.
              className="flex [scrollbar-width:none] flex-row-reverse gap-1 overflow-x-auto overscroll-x-contain [mask-image:linear-gradient(to_right,transparent,black_1.5rem)] p-1.5"
            >
              {shown.map((app) => (
                <AppTile key={app.id} app={app} onOpen={onOpen} compact className="w-[4.25rem] shrink-0" />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/** Done with the search (an app or Firefox opens): the keyboard goes away. */
function closeKeyboard() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

/**
 * The phone's apps, inside the launcher app: all apps A–Z, a search that
 * filters them and searches the web in Firefox. Home in the tab bar switches
 * between the home screen and this page.
 */
export function AppsView() {
  const isLauncher = useIsLauncher();
  const { apps, features } = useLauncherState();
  const [query, setQuery] = useState("");
  const [recentOpen, setRecentOpen] = useState(readRecentOpen);
  const hasRecent = features.includes("recent");

  const term = query.trim().toLowerCase();
  // Searching: names that start with the text first.
  const shown = useMemo(() => {
    const all = (apps ?? []).filter((app) => !term || app.label.toLowerCase().includes(term));
    if (!term) return all;
    const starts = (app: LauncherApp) => (app.label.toLowerCase().startsWith(term) ? 0 : 1);
    return [...all].sort((a, b) => starts(a) - starts(b));
  }, [apps, term]);

  if (!isLauncher) {
    return (
      <>
        <PageHeader title="Apps" />
        <PageBody>
          <Card className="mx-auto max-w-xl items-center gap-3 p-6 text-center">
            <LayoutGrid className="size-8 text-faint" />
            <p className="text-sm text-muted">
              Your phone&apos;s apps show up here in the Android launcher app. Get it in{" "}
              <AppLink href="/settings" className="font-semibold text-accent">
                Settings
              </AppLink>
              .
            </p>
          </Card>
        </PageBody>
      </>
    );
  }

  const searchWeb = () => {
    void launcher.search(query);
    setQuery("");
    closeKeyboard();
  };
  const opened = () => {
    setQuery("");
    closeKeyboard();
  };
  // Stays open or closed on this phone, as you left it.
  const toggleRecent = () => {
    setRecentOpen(!recentOpen);
    try {
      localStorage.setItem(RECENT_KEY, recentOpen ? "0" : "1");
    } catch {
      // Private mode – remembered until the page reloads.
    }
  };

  return (
    <FillPage>
      <PageHeader title="Apps" subtitle={apps ? `${apps.length} apps` : undefined} />
      <PageBody className={FILL_BODY}>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="-mx-4 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-3">
            {apps === null ? (
              <ul className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-6">
                {Array.from({ length: 16 }, (_, i) => (
                  <li key={i} className="flex flex-col items-center gap-1.5 py-2">
                    <span className="skeleton size-14 rounded-2xl" />
                    <span className="skeleton h-2.5 w-12" />
                  </li>
                ))}
              </ul>
            ) : shown.length === 0 ? (
              <p className="mt-auto py-8 text-center text-sm text-muted">No app called “{query.trim()}”.</p>
            ) : term ? (
              // Search results start at the bottom right, next to the thumb, and go up from there.
              <ul className="mt-auto flex flex-row-reverse flex-wrap-reverse gap-y-3" aria-label="Apps">
                {shown.map((app) => (
                  <AppTile key={app.id} app={app} onOpen={opened} className="w-1/4 px-1 sm:w-1/6" />
                ))}
              </ul>
            ) : (
              <ul className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-6" aria-label="Apps">
                {shown.map((app) => (
                  <AppTile key={app.id} app={app} onOpen={opened} />
                ))}
              </ul>
            )}
            {term && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={searchWeb}
                className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-surface-strong px-4 py-3 text-left text-sm shadow-(--shadow-card)"
              >
                <Globe className="size-5 shrink-0 text-fg" />
                <span className="min-w-0 flex-1 truncate">
                  Search the web for <span className="font-semibold">“{query.trim()}”</span>
                </span>
                <span className="text-xs text-faint">Firefox</span>
              </button>
            )}
          </div>
          {/* Search at the bottom, near the thumb – apps first, Enter searches the web. */}
          <div className="rounded-(--radius-bar) p-2 bar">
            {hasRecent && apps && (
              <RecentTray
                apps={apps}
                // Out of the way while searching.
                open={recentOpen && !term}
                onOpen={opened}
              />
            )}
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                searchWeb();
              }}
              // A quiet frame while typing: searching belongs to no section.
              className={cn("flex items-center gap-2", FIELD_FOCUS.quiet)}
            >
              <label className="relative flex min-w-0 flex-1 items-center">
                <Search className="pointer-events-none absolute left-4 size-[18px] text-faint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search apps or web"
                  aria-label="Search apps or the web"
                  enterKeyHint="search"
                  autoComplete="off"
                  className="field h-12 w-full rounded-2xl pr-10 pl-11 text-[0.95rem] outline-none well placeholder:text-faint focus:border-(--field-focus)"
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Clear"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setQuery("")}
                    className="absolute right-1.5 grid size-9 place-items-center rounded-xl text-faint"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </label>
              <button
                type="submit"
                aria-label="Search the web"
                onMouseDown={(e) => e.preventDefault()}
                className={cn(
                  "ui-action grid size-12 shrink-0 place-items-center rounded-2xl bg-fg text-bg shadow-(--shadow-card)",
                )}
              >
                <Globe className="size-5" />
              </button>
              {hasRecent && (
                <button
                  type="button"
                  aria-label="Recent apps"
                  aria-pressed={recentOpen}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={toggleRecent}
                  // Pressed in like the tray it opened; raised while closed.
                  className={cn(
                    "grid size-12 shrink-0 place-items-center rounded-2xl transition-colors",
                    recentOpen ? "text-fg well" : "bg-surface-strong text-muted shadow-(--shadow-card)",
                  )}
                >
                  <History className="size-5" />
                </button>
              )}
            </form>
          </div>
        </div>
      </PageBody>
    </FillPage>
  );
}
