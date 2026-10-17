"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { appsIsBelow, homeIsBelow } from "@/components/shell/app-link";
import { useBlockApp, useBlockedApps } from "@/data/blocked-apps";
import { newId } from "@/data/core";
import {
  connectLauncher,
  getHomeView,
  latestLauncherVersion,
  launcher,
  onLauncherEvent,
  refreshApps,
  refreshFilter,
  setUpdateStatus,
  getLauncherState,
  useIsLauncher,
  useLauncherState,
} from "@/lib/launcher";

const UPDATE_MESSAGES: Partial<Record<string, string>> = {
  permission: 'Allow "Install unknown apps" for Smart Assistant, then tap Install again.',
  installing: "Confirm the update to finish.",
  failed: "The update didn't work – try again in a moment.",
};

/**
 * Inside the Android launcher app: connects to it, keeps the status bar in the
 * dashboard's colours, and reacts to the home button and to installed apps.
 */
const BLOCKED_MOVED_KEY = "ssa:blocked-apps-moved";

/**
 * The blocked apps live in the account (table blocked_apps); the phone enforces
 * whatever it was last given. So: hand it the list whenever it changes – also
 * when a row is deleted in the Supabase dashboard (realtime). Apps blocked on
 * the phone before the list moved to the account are carried over once.
 */
function useSyncBlockedApps(isLauncher: boolean) {
  const { data } = useBlockedApps(isLauncher);
  // (`mutate` keeps its identity, unlike the mutation object.)
  const { mutate: block } = useBlockApp();
  const moving = useRef(false);

  useEffect(() => {
    if (!isLauncher || !data) return;
    let moved = true;
    try {
      moved = localStorage.getItem(BLOCKED_MOVED_KEY) === "1";
    } catch {
      // Private mode: nothing to carry over then.
    }
    if (moved) {
      void launcher.setBlockedApps(data.map((b) => b.package));
      return;
    }
    if (moving.current) return;
    moving.current = true;
    void (async () => {
      await refreshFilter();
      const { filter, apps } = getLauncherState();
      const known = new Set(data.map((b) => b.package));
      for (const pkg of filter?.blocked ?? []) {
        if (known.has(pkg)) continue;
        const label = apps?.find((a) => a.package === pkg)?.label ?? "";
        block({ id: newId(), package: pkg, label });
      }
      try {
        localStorage.setItem(BLOCKED_MOVED_KEY, "1");
      } catch {
        // Tried again next time; inserting twice is harmless.
      }
      void launcher.setBlockedApps([...known, ...(filter?.blocked ?? [])]);
    })();
  }, [isLauncher, data, block]);
}

export function LauncherSync() {
  const isLauncher = useIsLauncher();
  useSyncBlockedApps(isLauncher);
  const router = useRouter();
  const pathname = usePathname();
  const path = useRef(pathname);

  useEffect(() => {
    path.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!isLauncher) return;
    void connectLauncher();

    // The status bar follows the look (design, light/dark: the background colour).
    const root = document.documentElement;
    let posted = "";
    const postTheme = () => {
      const color = getComputedStyle(root).getPropertyValue("--bg").trim();
      const dark = root.classList.contains("dark");
      // Only real changes (the look is set again each time the page comes back).
      if (!color || posted === `${color}|${dark}`) return;
      posted = `${color}|${dark}`;
      void launcher.theme(color, dark);
    };
    postTheme();
    const observer = new MutationObserver(postTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class", "data-design"] });

    const stop = onLauncherEvent((event) => {
      if (event.type === "home") {
        // Home button: back to the home screen – or the apps, if that's what Home is switched to.
        const target = getHomeView() === "apps" ? "/apps" : "/";
        // Back from an app the page jumps: a tap during a scroll animation would only stop it.
        const behavior = event.returning === true ? "instant" : "smooth";
        if (path.current === target) window.scrollTo({ top: 0, behavior });
        else if (target === "/") {
          if (homeIsBelow()) router.back();
          else router.replace("/");
        } else if (path.current === "/") router.push("/apps");
        else if (appsIsBelow()) router.back();
        else router.replace("/apps");
      } else if (event.type === "appsChanged") {
        void refreshApps();
      } else if (event.type === "updateStatus" && event.status) {
        setUpdateStatus(event.status);
        const message = UPDATE_MESSAGES[event.status];
        if (message) toast(message);
      }
    });
    return () => {
      observer.disconnect();
      stop();
    };
  }, [isLauncher, router]);

  return null;
}

/** How often a launcher that stays open looks for a newer version. */
const UPDATE_CHECK_EVERY = 30 * 60_000;

/**
 * Whether a newer launcher app has been published on this server. A launcher
 * is hardly ever restarted, so it looks again whenever it comes back to the
 * front and every half hour – not only when it starts.
 */
export function useLauncherUpdate() {
  const { version, update } = useLauncherState();
  const [latest, setLatest] = useState<{ versionCode: number; versionName: string } | null>(null);
  useEffect(() => {
    if (version === null) return;
    let cancelled = false;
    const check = () => {
      void latestLauncherVersion().then((found) => {
        if (!cancelled && found) setLatest(found);
      });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    check();
    const timer = window.setInterval(check, UPDATE_CHECK_EVERY);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [version]);
  return {
    version,
    latest,
    available: latest !== null && version !== null && latest.versionCode > version,
    status: update,
  };
}
