"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * What was last opened to watch on this device (an episode or a film), so the
 * page can ask "Seen it?" when you come back – the streaming sites can't tell us.
 * Kept per device (the TV and the phone each ask about their own).
 */
export type Watching = { id: string; title: string; season?: number; episode?: number; at: number };

const KEY = "ssa:media-watching";
const EVENT = "ssa:media-watching";

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function write(value: Watching | null) {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value));
    else localStorage.removeItem(KEY);
  } catch {
    // Without storage there is just no question afterwards.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useWatching() {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  let watching: Watching | null = null;
  try {
    watching = raw ? (JSON.parse(raw) as Watching) : null;
  } catch {
    watching = null;
  }
  const start = useCallback((value: Omit<Watching, "at">) => write({ ...value, at: Date.now() }), []);
  const clear = useCallback(() => write(null), []);
  return { watching, start, clear };
}
