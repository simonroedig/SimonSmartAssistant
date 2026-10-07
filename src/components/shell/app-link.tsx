"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const HOME_BELOW_KEY = "ssa:home-below";

function homeIsBelow(): boolean {
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
    if (previous.current === "/" && pathname !== "/") {
      try {
        sessionStorage.setItem(HOME_BELOW_KEY, "1");
      } catch {
        // Private mode – back simply goes through the history then.
      }
    }
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
  const fromHome = pathname === "/";

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
        if (!fromHome && href === "/") {
          e.preventDefault();
          if (homeIsBelow()) router.back();
          else router.replace("/");
        }
      }}
      {...props}
    />
  );
}
