"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { LauncherSync } from "@/components/launcher/launcher-sync";
import { useSyncStatus } from "@/components/providers/realtime-provider";
import { useSettings, useSettingsRow } from "@/data/settings";
import { setHomeView, useHomeView, useIsLauncher } from "@/lib/launcher";
import {
  DEFAULT_NAVIGATION,
  NAVIGATION_COOKIE,
  type NavigationPreferences,
  PHONE_MORE,
  phoneTabs,
  railItems,
  type SectionId,
} from "@/lib/navigation";
import { TONE_STYLES } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { AppLink, useTrackHomeBelow } from "./app-link";
import { HOME_ITEM, isActive, MEDIA_ITEM, navItem, SETTINGS_ITEM, WEATHER_ITEM, type NavItem } from "./nav-items";

const NavigationContext = createContext<NavigationPreferences>(DEFAULT_NAVIGATION);

/** The menu preferences as the shell shows them (right from the first render). */
export function useNavigationPreferences(): NavigationPreferences {
  return useContext(NavigationContext);
}

const MORE_ITEMS: NavItem[] = PHONE_MORE.map((id) =>
  id === "media" ? MEDIA_ITEM : id === "weather" ? WEATHER_ITEM : SETTINGS_ITEM,
);

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

/** A side bar item's height: 4.25rem, less in a low window (set on the rail as --rail-item). */
const RAIL_ITEM = "var(--rail-item, 4.25rem)";
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
          height: RAIL_ITEM,
          transform: `translateY(calc(${Math.max(0, index)} * (${RAIL_ITEM} + ${RAIL_GAP_REM}rem)))`,
        };
  return (
    <span
      aria-hidden="true"
      style={style}
      className={cn(
        "ui-pill pointer-events-none absolute rounded-(--pill-radius) transition-[transform,opacity,background-color] ease-[cubic-bezier(0.22,1,0.36,1)]",
        // Quick on the phone's bar (often tapped back and forth), calmer in the side bar.
        axis === "x" ? "duration-200" : "duration-300",
        axis === "x" ? "inset-y-0 left-0" : "inset-x-0 top-0",
        tone.soft,
        index < 0 && "opacity-0",
      )}
    />
  );
}

/**
 * The highlight of a tab bar with two pages side by side: placed by page and tab, so
 * going from a tab on one page to one on the other slides it across, not in from the edge.
 */
function PagesPill({ pages, isCurrent }: { pages: NavItem[][]; isCurrent: (href: string) => boolean }) {
  const page = pages.findIndex((list) => list.some((item) => isCurrent(item.href)));
  const list = pages[Math.max(0, page)];
  const index = list.findIndex((item) => isCurrent(item.href));
  const share = 100 / pages.length;
  const width = share / list.length;
  const tone = TONE_STYLES[list[Math.max(0, index)].tone];
  return (
    <span
      aria-hidden="true"
      style={{ left: `${Math.max(0, page) * share + Math.max(0, index) * width}%`, width: `${width}%` }}
      className={cn(
        "ui-pill pointer-events-none absolute inset-y-0 rounded-(--pill-radius) transition-[left,width,opacity,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        tone.soft,
        page < 0 && "opacity-0",
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
      title={item.label}
      style={{ height: RAIL_ITEM }}
      className={cn(
        "group relative flex w-full flex-col items-center justify-center gap-1 rounded-(--pill-radius) text-[0.68rem] font-medium transition-colors",
        active ? "text-fg" : "text-muted hover:text-fg",
      )}
    >
      {pill && active && <span className={cn("ui-pill absolute inset-0 rounded-(--pill-radius)", tone.soft)} />}
      <Icon
        className={cn(
          "relative size-6 shrink-0 transition-opacity [@media(max-height:560px)]:size-5",
          tone.text,
          !active && "opacity-75 group-hover:opacity-100",
        )}
        strokeWidth={active ? 2.2 : 1.9}
      />
      {/* A very low window: icons only (the name stays for screen readers and as a tooltip). */}
      <span className="relative [@media(max-height:460px)]:sr-only">
        {item.label}
        {/* Right under the word, so it clearly belongs to Home. */}
        {anchor && <AnchorLine className="-bottom-1.5 left-1/2 -translate-x-1/2" />}
      </span>
    </AppLink>
  );
}

function NavRail({
  order,
  attached,
  isCurrent,
  onNavigate,
  home,
}: {
  order: (SectionId | "home")[];
  attached: boolean;
  isCurrent: (href: string) => boolean;
  onNavigate: (href: string) => void;
  home: { item: NavItem; target: string };
}) {
  const items = order.map(navItem);
  // In a low window (e.g. a third of a screen) the items share the height left over,
  // so Settings and the sync dot stay in view; what doesn't fit even then scrolls.
  const fit = `clamp(2.5rem, calc((100dvh - 2 * var(--gutter) - 5.75rem) / ${items.length + 1}), 4.25rem)`;
  return (
    <nav
      aria-label="Main"
      data-attached={attached ? "" : undefined}
      style={{ "--rail-item": fit } as React.CSSProperties}
      className={cn(
        "fixed z-40 no-scrollbar hidden w-[4.75rem] flex-col items-center overflow-y-auto px-1.5 py-4 glass md:flex",
        // The highlight's corners follow the bar's (its radius less the padding), so they run alike.
        attached
          ? "inset-y-0 left-0 [--pill-radius:1rem]"
          : "inset-y-(--gutter) left-(--gutter) rounded-(--radius-card) [--pill-radius:max(0.5rem,calc(var(--radius-card)-0.375rem))]",
      )}
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
        "relative flex flex-1 flex-col items-center gap-0.5 rounded-(--pill-radius) py-2 text-[0.65rem] font-medium transition-colors active:scale-95",
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
  attached,
  isCurrent,
  onNavigate,
  home,
}: {
  order: (SectionId | "home")[];
  attached: boolean;
  isCurrent: (href: string) => boolean;
  onNavigate: (href: string) => void;
  home: { item: NavItem; target: string };
}) {
  const items = order.map(navItem);
  const pager = useRef<HTMLDivElement>(null);
  // A second page (swiped to) with Media, Weather and Settings.
  const onMorePage = MORE_ITEMS.some((item) => isCurrent(item.href));
  // Showing a page of the second set: the bar shows that set (and the first one otherwise).
  useEffect(() => {
    const el = pager.current;
    if (!el) return;
    const target = onMorePage ? el.clientWidth : 0;
    if (Math.abs(el.scrollLeft - target) > 2) el.scrollTo({ left: target, behavior: "instant" });
  }, [onMorePage]);

  const tabs = (list: NavItem[]) => (
    <div className="relative flex w-1/2 shrink-0 snap-start">
      {list.map((item) =>
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
  );

  return (
    <nav
      aria-label="Main"
      data-tabbar
      data-attached={attached ? "" : undefined}
      className={cn(
        "fixed z-40 flex p-1.5 bar md:hidden",
        // Floating: as wide as the cards (px-4), just above the gesture bar.
        // The highlight's corners follow the bar's (its radius less the padding), so they run alike.
        attached
          ? "inset-x-0 bottom-0 pb-[calc(var(--safe-bottom)+0.375rem)] [--pill-radius:1rem]"
          : "inset-x-4 bottom-[calc(var(--safe-bottom)+0.75rem)] rounded-(--radius-bar) [--pill-radius:max(0.5rem,calc(var(--radius-bar)-0.375rem))]",
      )}
    >
      {/* Two pages side by side: swipe the bar for the second (it snaps to either) – no page dots.
          Up and down still go to the page behind (a scroll may start on the bar). */}
      <div
        ref={pager}
        data-tab-pages
        className="no-scrollbar flex flex-1 [touch-action:manipulation] snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {/* One highlight for both pages: it glides from the tab you were on, wherever it is. */}
        <div className="relative flex w-[200%] shrink-0">
          <PagesPill pages={[items, MORE_ITEMS]} isCurrent={isCurrent} />
          {tabs(items)}
          {tabs(MORE_ITEMS)}
        </div>
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
    <NavigationContext.Provider value={navigation}>
      <div className="relative min-h-dvh" data-phone-nav={navigation.phoneStyle} data-rail-nav={navigation.railStyle}>
        {/* Android app: the page shows through the status bar; a soft veil keeps its icons legible. */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 z-[45] h-(--safe-top) bg-linear-to-b from-(--bg)/70 to-transparent"
        />
        {pendingHref && (
          <div className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden" role="progressbar" aria-label="Loading">
            <div className="nav-progress h-full w-1/3 rounded-full bg-accent" />
          </div>
        )}
        <LauncherSync />
        <NavRail
          order={railItems(navigation)}
          attached={navigation.railStyle === "attached"}
          isCurrent={isCurrent}
          onNavigate={onNavigate}
          home={home}
        />
        <main className="min-h-dvh pb-(--page-bottom) md:pb-0 md:pl-(--rail-space)">
          {children}
          {/* Room for the on-screen keyboard so focused fields can scroll above it. */}
          <div aria-hidden="true" style={{ height: "var(--osk-height, 0px)" }} />
        </main>
        <BottomNav
          order={phoneTabs(navigation)}
          attached={navigation.phoneStyle === "attached"}
          isCurrent={isCurrent}
          onNavigate={onNavigate}
          home={home}
        />
      </div>
    </NavigationContext.Provider>
  );
}
