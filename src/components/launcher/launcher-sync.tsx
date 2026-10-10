"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { appsIsBelow, homeIsBelow } from "@/components/shell/app-link";
import {
  connectLauncher,
  getHomeView,
  latestLauncherVersion,
  launcher,
  onLauncherEvent,
  refreshApps,
  setUpdateStatus,
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
export function LauncherSync() {
  const isLauncher = useIsLauncher();
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
        if (path.current === target) window.scrollTo({ top: 0, behavior: "smooth" });
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

/** Whether a newer launcher app has been published on this server. */
export function useLauncherUpdate() {
  const { version, update } = useLauncherState();
  const [latest, setLatest] = useState<{ versionCode: number; versionName: string } | null>(null);
  useEffect(() => {
    if (version === null) return;
    let cancelled = false;
    void latestLauncherVersion().then((found) => {
      if (!cancelled) setLatest(found);
    });
    return () => {
      cancelled = true;
    };
  }, [version]);
  return {
    version,
    latest,
    available: latest !== null && version !== null && latest.versionCode > version,
    status: update,
  };
}
