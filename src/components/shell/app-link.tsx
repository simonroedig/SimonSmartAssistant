"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const HOME_BELOW_KEY = "ssa:home-below";
const APPS_BELOW_KEY = "ssa:apps-below";

function flag(key: string, value?: boolean): boolean {
  try {
    if (value !== undefined) sessionStorage.setItem(key, value ? "1" : "0");
    return sessionStorage.getItem(key) === "1";
  } catch {
    // Private mode – back simply goes through the history then.
    return false;
  }
}

/**
 * The launcher's apps page is a second home: sections opened from it sit on
 * top of it, so back leads to the apps first and then home.
 */
export function appsIsBelow(): boolean {
  return flag(APPS_BELOW_KEY);
}

/** Pages that act as a home: leaving them adds a history entry. */
function isHomeLike(path: string) {
  return path === "/" || path === "/apps";
}

/** Whether the history entry below this page is the home screen. */
export function homeIsBelow(): boolean {
  try {
    return sessionStorage.getItem(HOME_BELOW_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Remembers whether the history entry below the current page is the home
 * screen. Leaving home is always a forward navigation, so the first page after
 * home sits right above it.
 */
export function useTrackHomeBelow() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (previous.current === "/" && pathname !== "/") flag(HOME_BELOW_KEY, true);
    if (isHomeLike(pathname)) flag(APPS_BELOW_KEY, false);
    else if (previous.current === "/apps") flag(APPS_BELOW_KEY, true);
    previous.current = pathname;
  }, [pathname]);
}

/**
 * Link between the main sections that behaves like a native app: home → section
 * adds one history entry, section → section replaces it, and section → home goes
 * back. So the back gesture always leads to home first and then out of the app.
 */
export function AppLink({
  href,
  onClick,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "href"> & { href: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const fromHome = isHomeLike(pathname);

  return (
    <Link
      href={href}
      replace={!fromHome}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (href === pathname) {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        if (pathname !== "/" && href === "/") {
          e.preventDefault();
          if (homeIsBelow()) router.back();
          else router.replace("/");
        } else if (!fromHome && href === "/apps") {
          e.preventDefault();
          if (appsIsBelow()) router.back();
          else router.replace("/apps");
        }
      }}
      {...props}
    />
  );
}
