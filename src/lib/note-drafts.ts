"use client";

import { useSyncExternalStore } from "react";

/**
 * Notes being written are kept on this device until the server has them: if saving
 * fails (offline, a lapsed session) or the editor goes away unexpectedly, nothing that
 * was typed is lost – the notes page offers to save it again. Never used for the vault.
 */
export type NoteBackup = { id: string; title: string; body: string; categoryId: string | null };

const KEY = "ssa:note-drafts";
const listeners = new Set<() => void>();
let cache: { raw: string | null; list: NoteBackup[] } = { raw: null, list: [] };
/** Drafts still being written (an open editor, the "Take a note…" box): not left behind. */
const active = new Set<string>();
let activeVersion = 0;
let shown: { raw: string | null; version: number; list: NoteBackup[] } = { raw: null, version: -1, list: [] };

function read(): NoteBackup[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cache.list;
  }
  if (raw === cache.raw) return cache.list;
  let list: NoteBackup[] = [];
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      list = parsed.filter(
        (d): d is NoteBackup =>
          !!d && typeof d.id === "string" && typeof d.title === "string" && typeof d.body === "string",
      );
    }
  } catch {
    list = [];
  }
  cache = { raw, list };
  return list;
}

function write(list: NoteBackup[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: nothing to keep then.
  }
  listeners.forEach((l) => l());
}

/** Keeps what's typed (an empty note keeps nothing). */
export function keepNoteDraft(draft: NoteBackup) {
  const others = read().filter((d) => d.id !== draft.id);
  write(draft.title.trim() || draft.body.trim() ? [...others, draft] : others);
}

export function dropNoteDraft(id: string) {
  const list = read();
  if (list.some((d) => d.id === id)) write(list.filter((d) => d.id !== id));
}

/** Whether the server's note holds exactly what was typed. */
export function draftMatches(draft: NoteBackup, note: { title: string | null; body: string }): boolean {
  return (draft.title.trim() || null) === (note.title ?? null) && draft.body.replace(/\s+$/, "") === note.body;
}

/** A draft is being written right now (true) or no longer (false). */
export function setDraftActive(id: string, on: boolean) {
  if (on) active.add(id);
  else active.delete(id);
  activeVersion += 1;
  listeners.forEach((l) => l());
}

/** Backups nobody is writing any more – saved, or left behind (the page decides which). */
function readIdle(): NoteBackup[] {
  const list = read();
  if (shown.raw !== cache.raw || shown.version !== activeVersion) {
    shown = { raw: cache.raw, version: activeVersion, list: list.filter((d) => !active.has(d.id)) };
  }
  return shown.list;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const EMPTY: NoteBackup[] = [];

export function useNoteDrafts(): NoteBackup[] {
  return useSyncExternalStore(subscribe, readIdle, () => EMPTY);
}

// --- Links in notes ---------------------------------------------------------------

const LINK = /https?:\/\/[^\s<>()"']+[^\s<>()"'.,;:!?]/g;

/** The web links in a note's text (each once, at most `max`). */
export function findLinks(text: string, max = 3): { href: string; label: string }[] {
  const seen = new Set<string>();
  const out: { href: string; label: string }[] = [];
  for (const match of text.matchAll(LINK)) {
    let url: URL;
    try {
      url = new URL(match[0]);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    const path = url.pathname === "/" ? "" : url.pathname;
    const label = `${url.hostname.replace(/^www\./, "")}${path}`;
    out.push({ href: url.href, label: label.length > 40 ? `${label.slice(0, 39)}…` : label });
    if (out.length >= max) break;
  }
  return out;
}
