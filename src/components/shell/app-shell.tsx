"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { LauncherSync } from "@/components/launcher/launcher-sync";
import { useSyncStatus } from "@/components/providers/realtime-provider";
import { useSettings, useSettingsRow } from "@/data/settings";
import { setHomeView, useHomeView, useIsLauncher } from "@/lib/launcher";
import { NAVIGATION_COOKIE, type NavigationPreferences, phoneTabs, railItems, type SectionId } from "@/lib/navigation";
import { TONE_STYLES } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { AppLink, useTrackHomeBelow } from "./app-link";
import { HOME_ITEM, isActive, navItem, SETTINGS_ITEM, type NavItem } from "./nav-items";

function SyncDot() {
  const status = useSyncStatus();
  const tone = {
    live: "bg-emerald-400 shadow-[0_0_10px_rgb(52_211_153/0.8)]",
    connecting: "bg-amber-300",
    reconnecting: "bg-amber-400 animate-pulse",
    offline: "bg-rose-400",
  }[status];
  const label = { live: "Synced live", connecting: "Connecting…", reconnecting: "Reconnecting…", offline: "Offline" }[
    status
  ];
  return (
    <span className="flex items-center justify-center" title={label} aria-label={label} role="status">
      <span className={cn("size-2 rounded-full", tone)} />
    </span>
  );
}

const RAIL_ITEM_REM = 4.25;
const RAIL_GAP_REM = 0.25;

type LinkProps = { item: NavItem; active: boolean; onNavigate: (href: string) => void };

/**
 * In the Android launcher app, Home is a fixed switch between the home screen
 * and the phone's apps: tapping it there flips to the other one, and the choice
 * stays – from any other section the tab leads back to it. Everywhere else it is
 * the plain Home link.
 */
function useHomeSwitch(pathname: string) {
  const isLauncher = useIsLauncher();
  const remembered = useHomeView();
  // Whichever of the two is open is the current choice.
  useEffect(() => {
    if (!isLauncher) return;
    if (pathname === "/") setHomeView("home");
    else if (pathname === "/apps") setHomeView("apps");
  }, [isLauncher, pathname]);
  if (!isLauncher) return { item: HOME_ITEM, target: "/" };
  const view = pathname === "/" ? "home" : pathname === "/apps" ? "apps" : remembered;
  const item: NavItem = view === "apps" ? { ...HOME_ITEM, label: "Apps", icon: LayoutGrid } : HOME_ITEM;
  const target = pathname === "/" ? "/apps" : pathname === "/apps" ? "/" : view === "apps" ? "/apps" : "/";
  return { item, target };
}

/**
 * The order chosen in Settings. Until the settings are loaded it is the one the
 * server rendered with (from the cookie), so the bar doesn't jump on load.
 */
function useNavigation(initial: NavigationPreferences): NavigationPreferences {
  const row = useSettingsRow();
  const { settings } = useSettings();
  const loaded = row.data != null;
  useEffect(() => {
    if (!loaded) return;
    const value = encodeURIComponent(JSON.stringify(settings.navigation));
    if (document.cookie.split("; ").includes(`${NAVIGATION_COOKIE}=${value}`)) return;
    const secure = location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${NAVIGATION_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax${secure}`;
  }, [loaded, settings.navigation]);
  return loaded ? settings.navigation : initial;
}

/** The tab a path belongs to (the apps page belongs to Home). */
function tabOf(path: string) {
  return path === "/apps" ? "/" : path;
}

/**
 * Highlight behind the current tab. It slides by index with a plain CSS
 * transform (shared-layout animations jump when the page scroll changes
 * during navigation, because the bar is position: fixed).
 */
function SlidingPill({ index, items, axis }: { index: number; items: NavItem[]; axis: "x" | "y" }) {
  const tone = TONE_STYLES[items[Math.max(0, index)].tone];
  const style: React.CSSProperties =
    axis === "x"
      ? { width: `${100 / items.length}%`, transform: `translateX(${Math.max(0, index) * 100}%)` }
      : {
          height: `${RAIL_ITEM_REM}rem`,
          transform: `translateY(${Math.max(0, index) * (RAIL_ITEM_REM + RAIL_GAP_REM)}rem)`,
        };
  return (
    <span
      aria-hidden="true"
      style={style}
      className={cn(
        "ui-pill pointer-events-none absolute rounded-2xl transition-[transform,opacity,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        axis === "x" ? "inset-y-0 left-0" : "inset-x-0 top-0",
        tone.soft,
        index < 0 && "opacity-0",
      )}
    />
  );
}

/** Home: underlined as the app's anchor, in the rail and the tab bar alike. */
function AnchorLine({ className = "bottom-0.5" }: { className?: string }) {
  return <span aria-hidden="true" className={cn("absolute h-[3px] w-5 rounded-full bg-accent/70", className)} />;
}

function RailLink({
  item,
  active,
  onNavigate,
  pill = false,
  target = item.href,
  anchor = false,
}: LinkProps & { pill?: boolean; target?: string; anchor?: boolean }) {
  const Icon = item.icon;
  const tone = TONE_STYLES[item.tone];
  return (
    <AppLink
      href={target}
      aria-current={active ? "page" : undefined}
      onClick={() => onNavigate(target)}
      style={{ height: `${RAIL_ITEM_REM}rem` }}
      className={cn(
        "group relative flex w-full flex-col items-center justify-center gap-1 rounded-2xl text-[0.68rem] font-medium transition-colors",
        active ? "text-fg" : "text-muted hover:text-fg",
      )}
    >
      {pill && active && <span className={cn("ui-pill absolute inset-0 rounded-2xl", tone.soft)} />}
      <Icon
        className={cn("relative size-6 transition-opacity", tone.text, !active && "opacity-75 group-hover:opacity-100")}
        strokeWidth={active ? 2.2 : 1.9}
      />
      <span className="relative">
        {item.label}
        {/* Right under the word, so it clearly belongs to Home. */}
        {anchor && <AnchorLine className="-bottom-1.5 left-1/2 -translate-x-1/2" />}
      </span>
    </AppLink>
  );
}

function NavRail({
  order,
  isCurrent,
  onNavigate,
  home,
}: {
  order: (SectionId | "home")[];
  isCurrent: (href: string) => boolean;
  onNavigate: (href: string) => void;
  home: { item: NavItem; target: string };
}) {
  const items = order.map(navItem);
  return (
    <nav
      aria-label="Main"
      className="fixed inset-y-3 left-3 z-40 hidden w-[4.75rem] flex-col items-center rounded-(--radius-card) px-1.5 py-4 glass md:flex"
    >
      <div className="relative flex w-full flex-1 flex-col items-center" style={{ gap: `${RAIL_GAP_REM}rem` }}>
        <SlidingPill index={items.findIndex((item) => isCurrent(item.href))} items={items} axis="y" />
        {items.map((item) =>
          item.href === "/" ? (
            <RailLink
              key={item.href}
              item={home.item}
              target={home.target}
              active={isCurrent(item.href)}
              onNavigate={onNavigate}
              anchor
            />
          ) : (
            <RailLink key={item.href} item={item} active={isCurrent(item.href)} onNavigate={onNavigate} />
          ),
        )}
      </div>
      <div className="flex w-full flex-col items-center gap-3">
        <RailLink item={SETTINGS_ITEM} active={isCurrent(SETTINGS_ITEM.href)} onNavigate={onNavigate} pill />
        <SyncDot />
      </div>
    </nav>
  );
}

function TabLink({
  item,
  active,
  onNavigate,
  target = item.href,
  anchor = false,
}: LinkProps & { target?: string; anchor?: boolean }) {
  const Icon = item.icon;
  const tone = TONE_STYLES[item.tone];
  return (
    <AppLink
      href={target}
      aria-current={active ? "page" : undefined}
      onClick={() => onNavigate(target)}
      className={cn(
        "relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-[0.65rem] font-medium transition-colors active:scale-95",
        active ? "text-fg" : "text-muted",
      )}
    >
      <Icon
        className={cn("relative size-[1.4rem]", tone.text, !active && "opacity-80")}
        strokeWidth={active ? 2.2 : 1.9}
      />
      <span className="relative">{item.label}</span>
      {anchor && <AnchorLine />}
    </AppLink>
  );
}

function BottomNav({
  order,
  isCurrent,
  onNavigate,
  home,
}: {
  order: (SectionId | "home")[];
  isCurrent: (href: string) => boolean;
  onNavigate: (href: string) => void;
  home: { item: NavItem; target: string };
}) {
  const items = order.map(navItem);
  return (
    <nav
      aria-label="Main"
      data-tabbar
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex rounded-(--radius-bar) p-1.5 bar md:hidden"
    >
      <div className="relative flex flex-1">
        <SlidingPill index={items.findIndex((item) => isCurrent(item.href))} items={items} axis="x" />
        {items.map((item) =>
          item.href === "/" ? (
            <TabLink
              key={item.href}
              item={home.item}
              target={home.target}
              active={isCurrent(item.href)}
              onNavigate={onNavigate}
              anchor
            />
          ) : (
            <TabLink key={item.href} item={item} active={isCurrent(item.href)} onNavigate={onNavigate} />
          ),
        )}
      </div>
    </nav>
  );
}

function isTextField(el: Element | null): boolean {
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !["checkbox", "radio", "button", "submit", "range"].includes(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * Marks the page (`data-keyboard` on <html>) while a phone's on-screen keyboard
 * is up: a text field has the focus and the viewport got clearly shorter.
 */
function useKeyboardFlag() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let full = viewport.height;
    const update = () => {
      full = Math.max(full, viewport.height);
      const open = isTextField(document.activeElement) && viewport.height < full - 120;
      document.documentElement.toggleAttribute("data-keyboard", open);
    };
    const onFocusOut = () => window.setTimeout(update, 0);
    const onRotate = () => {
      full = 0;
      window.setTimeout(update, 300);
    };
    viewport.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("orientationchange", onRotate);
    return () => {
      viewport.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("orientationchange", onRotate);
      document.documentElement.removeAttribute("data-keyboard");
    };
  }, []);
}

export function AppShell({
  children,
  initialNavigation,
}: {
  children: React.ReactNode;
  initialNavigation: NavigationPreferences;
}) {
  const pathname = usePathname();
  const navigation = useNavigation(initialNavigation);
  useTrackHomeBelow();
  useKeyboardFlag();

  // Highlight the tapped tab right away; the page follows a moment later.
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  // Any finished navigation (including the back gesture) ends the pending state.
  const [shownPath, setShownPath] = useState(pathname);
  if (pathname !== shownPath) {
    setShownPath(pathname);
    setPending(null);
  }
  const pendingHref = pending && pending.from === pathname ? pending.href : null;
  const isCurrent = (href: string) => (pendingHref ? tabOf(pendingHref) === href : isActive(tabOf(pathname), href));
  const onNavigate = (href: string) => {
    if (!isActive(tabOf(pathname), tabOf(href))) setPending({ href, from: pathname });
  };
  const home = useHomeSwitch(pathname);

  return (
    <div className="relative min-h-dvh">
      {pendingHref && (
        <div className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden" role="progressbar" aria-label="Loading">
          <div className="nav-progress h-full w-1/3 rounded-full bg-accent" />
        </div>
      )}
      <LauncherSync />
      <NavRail order={railItems(navigation)} isCurrent={isCurrent} onNavigate={onNavigate} home={home} />
      <main className="min-h-dvh pb-(--page-bottom) md:pb-0 md:pl-[5.75rem]">
        {children}
        {/* Room for the on-screen keyboard so focused fields can scroll above it. */}
        <div aria-hidden="true" style={{ height: "var(--osk-height, 0px)" }} />
      </main>
      <BottomNav order={phoneTabs(navigation)} isCurrent={isCurrent} onNavigate={onNavigate} home={home} />
    </div>
  );
}
