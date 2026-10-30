"use client";

import { useEffect } from "react";
import { useDevicePrefs } from "@/hooks/use-device-prefs";
import { DIRECTIONS, pickNext } from "@/lib/spatial";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [role="button"][tabindex]:not([tabindex="-1"]), [tabindex="0"]';

function visible(el: HTMLElement): boolean {
  if (el.closest("[inert], [aria-hidden='true']")) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
}

/**
 * TV remote (device setting or ?tv=1): the arrow keys move the focus to the nearest
 * button in that direction, OK presses it, Back goes back – inside an open sheet
 * only within it. Text fields keep their arrow keys for the cursor.
 */
export function RemoteControl() {
  const [prefs] = useDevicePrefs();

  useEffect(() => {
    if (!prefs.remote) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const direction = DIRECTIONS[e.key];
      if (!direction || e.altKey || e.ctrlKey || e.metaKey) return;
      const active = document.activeElement as HTMLElement | null;
      // Typing: left/right move the cursor; up/down leave the field.
      if (
        active?.matches("input, textarea, [contenteditable='true']") &&
        (direction === "left" || direction === "right")
      ) {
        return;
      }
      const dialogs = document.querySelectorAll<HTMLElement>("[role='dialog']");
      const scope = dialogs.length ? dialogs[dialogs.length - 1] : document.body;
      const candidates = [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el !== active && visible(el),
      );
      if (candidates.length === 0) return;
      e.preventDefault();
      const from = active && active !== document.body && scope.contains(active) ? active.getBoundingClientRect() : null;
      let target: HTMLElement | undefined;
      if (!from) {
        // Nothing focused yet: start with the first thing in the page's content.
        target = scope.querySelector<HTMLElement>("main") ? candidates.find((el) => el.closest("main")) : undefined;
        target ??= candidates[0];
      } else {
        const index = pickNext(
          from,
          candidates.map((el) => el.getBoundingClientRect()),
          direction,
        );
        if (index < 0) {
          // At the edge: let the page scroll a little instead.
          if (direction === "up" || direction === "down")
            window.scrollBy({ top: direction === "up" ? -200 : 200, behavior: "smooth" });
          return;
        }
        target = candidates[index];
      }
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [prefs.remote]);

  return null;
}
