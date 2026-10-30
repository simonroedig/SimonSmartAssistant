"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps the picked chip of a sideways-scrolling row in view, a page margin
 * away from the screen's edge. When the row's start (or end) can show it, the
 * row goes all the way there – back to how the page opens on All, and at the
 * last chip with + and the pencil in sight, so it's clear there's no more.
 */
export function useScrollToPressed(key: unknown) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    // Toggle chips (aria-pressed) or tabs (aria-selected).
    const chips = [...el.querySelectorAll<HTMLElement>("[aria-pressed], [role='tab']")];
    const index = chips.findIndex(
      (c) => c.getAttribute("aria-pressed") === "true" || c.getAttribute("aria-selected") === "true",
    );
    if (index < 0) return;
    const margin = parseFloat(getComputedStyle(el).paddingLeft) || 16;
    const rowBox = el.getBoundingClientRect();
    const box = chips[index].getBoundingClientRect();
    const left = box.left - rowBox.left + el.scrollLeft;
    const right = left + box.width;
    const end = el.scrollWidth - el.clientWidth;
    let target: number;
    if (index === 0 || right + margin <= el.clientWidth) target = 0;
    else if (index === chips.length - 1 || left - margin >= end) target = end;
    else if (left - margin < el.scrollLeft) target = left - margin;
    else if (right + margin > el.scrollLeft + el.clientWidth) target = right + margin - el.clientWidth;
    else return;
    el.scrollTo({ left: Math.max(0, Math.min(end, target)), behavior: "smooth" });
  }, [key]);
  return row;
}
