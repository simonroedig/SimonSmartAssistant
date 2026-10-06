"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncStatus } from "@/components/providers/realtime-provider";
import { cn } from "@/lib/utils";
import { isActive, NAV_ITEMS, SETTINGS_ITEM, type NavItem } from "./nav-items";

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

function RailLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex w-full flex-col items-center gap-1 rounded-2xl py-2.5 text-[0.68rem] font-medium transition-colors",
        active ? "text-fg" : "text-faint hover:text-muted",
      )}
    >
      {active && (
        <motion.span
          layoutId="rail-active"
          className="absolute inset-x-1.5 inset-y-0 rounded-2xl bg-surface-hover ring-1 ring-line"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      )}
      <Icon className={cn("relative size-6", active && "text-accent")} strokeWidth={active ? 2.2 : 1.8} />
      <span className="relative">{item.label}</span>
    </Link>
  );
}

function NavRail({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-y-3 left-3 z-40 hidden w-[4.75rem] flex-col items-center rounded-[1.75rem] px-1.5 py-4 glass md:flex"
    >
      <Link href="/" aria-label="Home" className="mb-5 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="size-10 rounded-xl" draggable={false} />
      </Link>
      <div className="flex w-full flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <RailLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </div>
      <div className="flex w-full flex-col items-center gap-3">
        <RailLink item={SETTINGS_ITEM} active={isActive(pathname, SETTINGS_ITEM.href)} />
        <SyncDot />
      </div>
    </nav>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex rounded-[1.6rem] p-1.5 glass md:hidden"
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-[0.65rem] font-medium transition-colors",
              active ? "text-fg" : "text-faint",
            )}
          >
            {active && (
              <motion.span
                layoutId="tab-active"
                className="absolute inset-0 rounded-2xl bg-surface-hover"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <Icon className={cn("relative size-[1.4rem]", active && "text-accent")} strokeWidth={active ? 2.2 : 1.8} />
            <span className="relative">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="relative min-h-dvh">
      <NavRail pathname={pathname} />
      <main className="min-h-dvh pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-[5.75rem]">
        {children}
        {/* Room for the on-screen keyboard so focused fields can scroll above it. */}
        <div aria-hidden="true" style={{ height: "var(--osk-height, 0px)" }} />
      </main>
      <BottomNav pathname={pathname} />
    </div>
  );
}
