"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSyncStatus } from "@/components/providers/realtime-provider";
import { TONE_STYLES } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { AppLink, useTrackHomeBelow } from "./app-link";
import { isActive, RAIL_ITEMS, SETTINGS_ITEM, TAB_ITEMS, type NavItem } from "./nav-items";

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

type LinkProps = { item: NavItem; active: boolean; onNavigate: (href: string) => void };

function RailLink({ item, active, onNavigate }: LinkProps) {
  const Icon = item.icon;
  const tone = TONE_STYLES[item.tone];
  return (
    <AppLink
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={() => onNavigate(item.href)}
      className={cn(
        "group relative flex w-full flex-col items-center gap-1 rounded-2xl py-2.5 text-[0.68rem] font-medium transition-colors",
        active ? "text-fg" : "text-muted hover:text-fg",
      )}
    >
      {active && (
        <motion.span
          layoutId="rail-active"
          className={cn("absolute inset-x-1.5 inset-y-0 rounded-2xl", tone.soft)}
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      )}
      <Icon
        className={cn("relative size-6 transition-opacity", tone.text, !active && "opacity-75 group-hover:opacity-100")}
        strokeWidth={active ? 2.2 : 1.9}
      />
      <span className="relative">{item.label}</span>
    </AppLink>
  );
}

function NavRail({
  isCurrent,
  onNavigate,
}: {
  isCurrent: (href: string) => boolean;
  onNavigate: (href: string) => void;
}) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-y-3 left-3 z-40 hidden w-[4.75rem] flex-col items-center rounded-[1.75rem] px-1.5 py-4 glass md:flex"
    >
      <AppLink href="/" aria-label="Home" className="mb-5 block" onClick={() => onNavigate("/")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="size-10 rounded-xl" draggable={false} />
      </AppLink>
      <div className="flex w-full flex-1 flex-col items-center gap-1">
        {RAIL_ITEMS.map((item) => (
          <RailLink key={item.href} item={item} active={isCurrent(item.href)} onNavigate={onNavigate} />
        ))}
      </div>
      <div className="flex w-full flex-col items-center gap-3">
        <RailLink item={SETTINGS_ITEM} active={isCurrent(SETTINGS_ITEM.href)} onNavigate={onNavigate} />
        <SyncDot />
      </div>
    </nav>
  );
}

function TabLink({ item, active, onNavigate }: LinkProps) {
  const Icon = item.icon;
  const tone = TONE_STYLES[item.tone];
  return (
    <AppLink
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={() => onNavigate(item.href)}
      className={cn(
        "relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-[0.65rem] font-medium transition-colors active:scale-95",
        active ? "text-fg" : "text-muted",
      )}
    >
      {active && (
        <motion.span
          layoutId="tab-active"
          className={cn("absolute inset-0 rounded-2xl", tone.soft)}
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      )}
      <Icon
        className={cn("relative size-[1.4rem]", tone.text, !active && "opacity-80")}
        strokeWidth={active ? 2.2 : 1.9}
      />
      <span className="relative">{item.label}</span>
    </AppLink>
  );
}

function BottomNav({
  isCurrent,
  onNavigate,
}: {
  isCurrent: (href: string) => boolean;
  onNavigate: (href: string) => void;
}) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex rounded-[1.6rem] border border-line bg-(--nav-bg) p-1.5 shadow-(--shadow-card) md:hidden"
    >
      {TAB_ITEMS.map((item) => (
        <TabLink key={item.href} item={item} active={isCurrent(item.href)} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useTrackHomeBelow();

  // Highlight the tapped tab right away; the page follows a moment later.
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  const pendingHref = pending && pending.from === pathname ? pending.href : null;
  const isCurrent = (href: string) => (pendingHref ? pendingHref === href : isActive(pathname, href));
  const onNavigate = (href: string) => {
    if (!isActive(pathname, href)) setPending({ href, from: pathname });
  };

  return (
    <div className="relative min-h-dvh">
      {pendingHref && (
        <div className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden" role="progressbar" aria-label="Loading">
          <div className="nav-progress h-full w-1/3 rounded-full bg-accent" />
        </div>
      )}
      <NavRail isCurrent={isCurrent} onNavigate={onNavigate} />
      <main className="min-h-dvh pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-[5.75rem]">
        {children}
        {/* Room for the on-screen keyboard so focused fields can scroll above it. */}
        <div aria-hidden="true" style={{ height: "var(--osk-height, 0px)" }} />
      </main>
      <BottomNav isCurrent={isCurrent} onNavigate={onNavigate} />
    </div>
  );
}
