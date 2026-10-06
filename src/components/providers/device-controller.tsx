"use client";

import { useEffect } from "react";
import { applyDeviceState, DEVICE_STORAGE_KEY, SUN_STORAGE_KEY } from "@/lib/device";

/**
 * Keeps <html> in sync with the device preferences: re-evaluates the theme every
 * minute (for the sunrise/sunset "auto" theme), follows the system theme, and
 * exposes the space taken by on-screen keyboards as CSS variables.
 */
export function DeviceController() {
  useEffect(() => {
    const apply = () => applyDeviceState(DEVICE_STORAGE_KEY, SUN_STORAGE_KEY);
    apply();
    const interval = window.setInterval(apply, 60_000);
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    mql.addEventListener("change", apply);
    const onVisible = () => document.visibilityState === "visible" && apply();
    document.addEventListener("visibilitychange", onVisible);

    // Mobile keyboards: how much of the layout viewport is covered.
    const vv = window.visualViewport;
    const root = document.documentElement;
    const updateInset = () => {
      if (!vv) return;
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty("--keyboard-inset", `${Math.round(covered)}px`);
      root.style.setProperty("--sheet-bottom", `max(var(--osk-height, 0px), ${Math.round(covered)}px)`);
    };
    updateInset();
    vv?.addEventListener("resize", updateInset);
    vv?.addEventListener("scroll", updateInset);

    return () => {
      window.clearInterval(interval);
      mql.removeEventListener("change", apply);
      document.removeEventListener("visibilitychange", onVisible);
      vv?.removeEventListener("resize", updateInset);
      vv?.removeEventListener("scroll", updateInset);
    };
  }, []);

  return null;
}
