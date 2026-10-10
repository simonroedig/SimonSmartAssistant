"use client";

import { useSyncExternalStore } from "react";

/**
 * The Android launcher app shows this dashboard and injects `window.SmartLauncher`
 * (only for this site). Through it the page lists and opens the phone's apps,
 * searches the web in Firefox and updates the app. Everywhere else (browser,
 * wall display) the object is missing and all of this stays hidden.
 */

export type LauncherApp = { id: string; label: string; package: string; icon: string };
export type UpdateStatus = "idle" | "permission" | "downloading" | "installing" | "installed" | "failed";
type LauncherEvent = { type: string; status?: UpdateStatus; [key: string]: unknown };

type Bridge = {
  postMessage(message: string): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
};

declare global {
  interface Window {
    SmartLauncher?: Bridge;
  }
}

function bridge(): Bridge | null {
  return typeof window === "undefined" ? null : (window.SmartLauncher ?? null);
}

const pending = new Map<string, (data: Record<string, unknown> | null) => void>();
const eventListeners = new Set<(event: LauncherEvent) => void>();
let listening = false;

function listen(target: Bridge) {
  if (listening) return;
  listening = true;
  target.addEventListener("message", (event) => {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(String(event.data));
    } catch {
      return;
    }
    const id = typeof data.id === "string" ? data.id : null;
    const resolve = id ? pending.get(id) : undefined;
    if (id && resolve) {
      pending.delete(id);
      resolve(data);
      return;
    }
    eventListeners.forEach((listener) => listener(data as LauncherEvent));
  });
}

/** Asks the launcher app; resolves to null outside of it (or without an answer). */
function request(type: string, payload: Record<string, unknown> = {}): Promise<Record<string, unknown> | null> {
  const target = bridge();
  if (!target) return Promise.resolve(null);
  listen(target);
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve) => {
    pending.set(id, resolve);
    target.postMessage(JSON.stringify({ ...payload, id, type }));
    window.setTimeout(() => {
      if (pending.delete(id)) resolve(null);
    }, 20_000);
  });
}

export function onLauncherEvent(listener: (event: LauncherEvent) => void): () => void {
  const target = bridge();
  if (target) listen(target);
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

// --- A tiny store for what the page shows -----------------------------------

/** The apps used last (package names, newest first) – once usage access is allowed. */
export type RecentApps = { allowed: boolean; packages: string[] };

/** The app filter on the phone: whether it's enforced, and the apps it was last given. */
export type AppFilter = {
  /** The accessibility service is on, so a blocked app really gets sent home. */
  enabled: boolean;
  /** Package names the phone blocks (the list itself lives in the account: blocked_apps). */
  blocked: string[];
};

type State = {
  version: number | null;
  versionName: string | null;
  /** What the app can do beyond the basics (e.g. "recent"; older versions say nothing). */
  features: string[];
  apps: LauncherApp[] | null;
  recent: RecentApps | null;
  filter: AppFilter | null;
  update: UpdateStatus;
};

const APPS_KEY = "ssa:launcher-apps";
const FEATURES_KEY = "ssa:launcher-features";
let state: State = {
  version: null,
  versionName: null,
  features: [],
  apps: null,
  recent: null,
  filter: null,
  update: "idle",
};
const subscribers = new Set<() => void>();

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  subscribers.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  subscribers.add(notify);
  return () => subscribers.delete(notify);
}

const noSubscription = () => () => {};

/** True inside the launcher app (false on the server and while hydrating). */
export function useIsLauncher(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => bridge() !== null,
    () => false,
  );
}

/** The current state, outside of React (e.g. right after an `await`). */
export function getLauncherState(): State {
  return state;
}

export function useLauncherState(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

/** Says hello (the launcher answers with its version) and loads the apps. */
export async function connectLauncher() {
  if (!bridge()) return;
  if (!state.apps) {
    try {
      const cached = JSON.parse(localStorage.getItem(APPS_KEY) ?? "null");
      if (Array.isArray(cached)) setState({ apps: cached });
      // Known right away, so the search bar doesn't change while the app answers.
      const features = JSON.parse(localStorage.getItem(FEATURES_KEY) ?? "null");
      if (Array.isArray(features)) setState({ features });
    } catch {
      // No cache yet.
    }
  }
  const hello = await request("hello");
  if (hello) {
    const features = Array.isArray(hello.features) ? hello.features.map(String) : [];
    setState({ version: Number(hello.version) || null, versionName: String(hello.versionName ?? ""), features });
    try {
      localStorage.setItem(FEATURES_KEY, JSON.stringify(features));
    } catch {
      // Asked again next time.
    }
  }
  await refreshApps();
}

export async function refreshApps() {
  const answer = await request("apps");
  if (!answer || !Array.isArray(answer.apps)) return;
  const apps = (answer.apps as LauncherApp[]).sort((a, b) =>
    a.label.localeCompare(b.label, "de", { sensitivity: "base" }),
  );
  setState({ apps });
  try {
    localStorage.setItem(APPS_KEY, JSON.stringify(apps));
  } catch {
    // Too big or private mode – the list simply loads again next time.
  }
}

/** The apps used last, asked again whenever they're shown (an app may have been used meanwhile). */
export async function refreshRecent() {
  const answer = await request("recent");
  if (!answer || !Array.isArray(answer.apps)) return;
  setState({ recent: { allowed: answer.allowed === true, packages: answer.apps.map(String) } });
}

/** The app filter's state (enforced? which apps), asked again when its settings are shown. */
export async function refreshFilter() {
  const answer = await request("appFilter");
  if (!answer) return;
  setState({
    filter: {
      enabled: answer.enabled === true,
      blocked: Array.isArray(answer.blocked) ? answer.blocked.map(String) : [],
    },
  });
}

export function setUpdateStatus(update: UpdateStatus) {
  setState({ update });
}

export const launcher = {
  open: (app: LauncherApp) => request("launch", { app: app.id }),
  showInfo: (app: LauncherApp) => request("appInfo", { app: app.id }),
  /** Web search in Firefox (just opens Firefox without a query). */
  search: (query: string) => request("search", { query }),
  theme: (color: string, dark: boolean) => request("theme", { color, dark }),
  update: () => {
    setUpdateStatus("downloading");
    return request("update");
  },
  homeSettings: () => request("homeSettings"),
  /** The system page where usage access (for the apps used last) is allowed. */
  allowUsageAccess: () => request("usageAccess"),
  /** The accessibility settings, where the app filter is switched on. */
  openFilterSettings: () => request("filterSettings"),
  /** Hands the blocked apps (package names, from the account) to the phone, which enforces them. */
  setBlockedApps: (packages: string[]) => request("setBlockedApps", { packages }),
};

/** The newest launcher version published on this server (by the Android workflow). */
export async function latestLauncherVersion(): Promise<{ versionCode: number; versionName: string } | null> {
  try {
    const res = await fetch("/launcher/version.json", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    // versionCode 0: nothing published yet.
    return typeof data.versionCode === "number" && data.versionCode > 0 ? data : null;
  } catch {
    return null;
  }
}

// --- Home or apps: the tab's fixed switch ----------------------------------

export type HomeView = "home" | "apps";
const VIEW_KEY = "ssa:home-view";
const viewSubscribers = new Set<() => void>();
let homeView: HomeView | null = null;

/** What Home in the tab bar shows (and the home button opens): the last of the two you picked. */
export function getHomeView(): HomeView {
  if (homeView === null) {
    try {
      homeView = localStorage.getItem(VIEW_KEY) === "apps" ? "apps" : "home";
    } catch {
      homeView = "home";
    }
  }
  return homeView;
}

export function setHomeView(view: HomeView) {
  if (getHomeView() === view) return;
  homeView = view;
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Private mode – remembered until the app restarts.
  }
  viewSubscribers.forEach((notify) => notify());
}

export function useHomeView(): HomeView {
  return useSyncExternalStore(
    (notify) => {
      viewSubscribers.add(notify);
      return () => viewSubscribers.delete(notify);
    },
    getHomeView,
    () => "home",
  );
}
