"use client";

import { useEffect } from "react";
import { useDevicePrefs } from "@/hooks/use-device-prefs";
import { isDragging } from "@/lib/pointer";

/** How far the mouse moves (mostly sideways) before a press becomes a drag. */
const START_DISTANCE = 6;
const IGNORE = "input, textarea, select, [contenteditable='true'], [data-no-drag-scroll]";

function scrollsSideways(el: Element): boolean {
  const overflow = getComputedStyle(el).overflowX;
  return (overflow === "auto" || overflow === "scroll") && el.scrollWidth > el.clientWidth + 1;
}

/** The innermost element around `target` that scrolls sideways. */
function sidewaysScroller(target: Element): HTMLElement | null {
  for (let el: Element | null = target; el && el !== document.body; el = el.parentElement) {
    if (el instanceof HTMLElement && scrollsSideways(el)) return el;
  }
  return null;
}

type Gesture = {
  id: number;
  x: number;
  y: number;
  lastX: number;
  scroller: HTMLElement;
  active: boolean;
};

/**
 * On a computer, rows that scroll sideways (chips, seasons, the hourly forecast) can be
 * dragged with the mouse – for mice without a sideways wheel. A drag never counts as a
 * click on what it started on. The wall display has its own (TouchScroll).
 */
export function MouseDragScroll() {
  const [prefs] = useDevicePrefs();

  useEffect(() => {
    if (prefs.kiosk) return;

    let gesture: Gesture | null = null;
    let swallowClick = false;
    const root = document.documentElement;

    const end = () => {
      const g = gesture;
      gesture = null;
      if (!g?.active) return;
      g.scroller.style.removeProperty("scroll-snap-type");
      g.scroller.style.removeProperty("scroll-behavior");
      g.scroller.style.removeProperty("cursor");
      root.style.removeProperty("user-select");
      root.style.removeProperty("cursor");
      // The click that ends the drag comes right after; let it pass only once it's gone.
      window.setTimeout(() => (swallowClick = false), 0);
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      const target = e.target as Element | null;
      if (!target || target.closest(IGNORE)) return;
      const scroller = sidewaysScroller(target);
      if (!scroller) return;
      gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, scroller, active: false };
    };

    const onMove = (e: PointerEvent) => {
      const g = gesture;
      if (!g || g.id !== e.pointerId) return;
      if ((e.buttons & 1) === 0 || isDragging()) {
        end();
        return;
      }
      if (!g.active) {
        const dx = e.clientX - g.x;
        const dy = e.clientY - g.y;
        if (Math.hypot(dx, dy) < START_DISTANCE) return;
        if (Math.abs(dx) < Math.abs(dy)) {
          gesture = null;
          return;
        }
        g.active = true;
        swallowClick = true;
        // Follow the mouse exactly: no snapping or smooth scrolling while held.
        g.scroller.style.setProperty("scroll-snap-type", "none");
        g.scroller.style.setProperty("scroll-behavior", "auto");
        root.style.setProperty("user-select", "none");
        root.style.setProperty("cursor", "grabbing");
        g.scroller.style.setProperty("cursor", "grabbing");
        window.getSelection()?.removeAllRanges();
      }
      g.scroller.scrollLeft += g.lastX - e.clientX;
      g.lastX = e.clientX;
      e.preventDefault();
    };

    const onUp = (e: PointerEvent) => {
      if (gesture?.id === e.pointerId) end();
    };

    // Links and images inside the row would otherwise be dragged out instead.
    const onDragStart = (e: DragEvent) => {
      if (gesture) e.preventDefault();
    };

    const onClick = (e: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener("pointerdown", onDown, { capture: true, passive: true });
    window.addEventListener("pointermove", onMove, { capture: true });
    window.addEventListener("pointerup", onUp, { capture: true });
    window.addEventListener("pointercancel", onUp, { capture: true });
    window.addEventListener("click", onClick, { capture: true });
    window.addEventListener("dragstart", onDragStart, { capture: true });
    return () => {
      end();
      window.removeEventListener("pointerdown", onDown, { capture: true });
      window.removeEventListener("pointermove", onMove, { capture: true });
      window.removeEventListener("pointerup", onUp, { capture: true });
      window.removeEventListener("pointercancel", onUp, { capture: true });
      window.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("dragstart", onDragStart, { capture: true });
    };
  }, [prefs.kiosk]);

  return null;
}
