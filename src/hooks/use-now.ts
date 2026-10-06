"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * One shared clock for the whole app, aligned to full seconds. Components pick
 * a granularity and only re-render when that unit changes. Returns null during
 * server rendering and hydration (server time zone ≠ local time zone).
 */
const listeners = new Set<() => void>();
let current = typeof window === "undefined" ? 0 : Date.now();
let timer: ReturnType<typeof setTimeout> | null = null;

function tick() {
  current = Date.now();
  listeners.forEach((listener) => listener());
}

function schedule() {
  timer = setTimeout(
    () => {
      tick();
      schedule();
    },
    1000 - (Date.now() % 1000) + 8,
  );
}

function onVisibility() {
  if (document.visibilityState === "visible") tick();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    current = Date.now();
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearTimeout(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}

const getSecond = () => Math.floor(current / 1000);
const getMinute = () => Math.floor(current / 60_000);
const getServer = () => null;

export function useNow(granularity: "second" | "minute" = "minute"): Date | null {
  const unit = useSyncExternalStore(subscribe, granularity === "second" ? getSecond : getMinute, getServer);
  return useMemo(
    () => (unit === null ? null : new Date(granularity === "second" ? unit * 1000 : Math.max(unit * 60_000, current))),
    [unit, granularity],
  );
}
