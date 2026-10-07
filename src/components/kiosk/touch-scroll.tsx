"use client";

import { useEffect } from "react";
import { useDevicePrefs } from "@/hooks/use-device-prefs";
import { isDragging } from "@/lib/pointer";

const START_DISTANCE = 10;
/** Holding still this long first means "press and hold" (drag an item), not scroll. */
const HOLD_MS = 260;
const IGNORE = "input, textarea, select, [contenteditable='true'], [data-no-drag-scroll]";

function canScroll(el: Element, axis: "x" | "y"): boolean {
  const style = getComputedStyle(el);
  const overflow = axis === "y" ? style.overflowY : style.overflowX;
  if (overflow !== "auto" && overflow !== "scroll") return false;
  return axis === "y" ? el.scrollHeight > el.clientHeight + 1 : el.scrollWidth > el.clientWidth + 1;
}

/** Scrollable ancestors from the innermost outwards, ending with the page. */
function scrollChain(target: Element, axis: "x" | "y"): Element[] {
  const chain: Element[] = [];
  for (let el: Element | null = target; el && el !== document.body; el = el.parentElement) {
    if (canScroll(el, axis)) chain.push(el);
  }
  const page = document.scrollingElement;
  if (page && !chain.includes(page)) {
    const size = axis === "y" ? page.scrollHeight > page.clientHeight + 1 : page.scrollWidth > page.clientWidth + 1;
    if (size) chain.push(page);
  }
  return chain;
}

/** Scrolls the innermost element first and hands the rest to its parents. */
function scrollBy(chain: Element[], axis: "x" | "y", delta: number) {
  let rest = delta;
  for (const el of chain) {
    if (rest === 0) break;
    if (axis === "y") {
      const before = el.scrollTop;
      el.scrollTop = before + rest;
      rest -= el.scrollTop - before;
    } else {
      const before = el.scrollLeft;
      el.scrollLeft = before + rest;
      rest -= el.scrollLeft - before;
    }
  }
}

/**
 * Wall display: when the touch screen arrives as a mouse, dragging a finger
 * should still scroll lists and the timeline like on a phone (with a little
 * momentum), and the tap that ends a scroll must not trigger anything.
 */
export function TouchScroll() {
  const [prefs] = useDevicePrefs();

  useEffect(() => {
    if (!prefs.kiosk) return;

    let gesture: {
      id: number;
      x: number;
      y: number;
      t: number;
      lastX: number;
      lastY: number;
      lastT: number;
      velocity: number;
      axis: "x" | "y" | null;
      chain: Element[];
      target: Element;
    } | null = null;
    let swallowClick = false;
    let momentum = 0;

    const stopMomentum = () => {
      cancelAnimationFrame(momentum);
      momentum = 0;
    };

    const onDown = (e: PointerEvent) => {
      stopMomentum();
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      const target = e.target as Element | null;
      if (!target || target.closest(IGNORE)) return;
      gesture = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        t: e.timeStamp,
        lastX: e.clientX,
        lastY: e.clientY,
        lastT: e.timeStamp,
        velocity: 0,
        axis: null,
        chain: [],
        target,
      };
    };

    const onMove = (e: PointerEvent) => {
      const g = gesture;
      if (!g || g.id !== e.pointerId) return;
      if (isDragging()) {
        gesture = null;
        return;
      }
      if (!g.axis) {
        const dx = e.clientX - g.x;
        const dy = e.clientY - g.y;
        if (Math.hypot(dx, dy) < START_DISTANCE) return;
        if (e.timeStamp - g.t > HOLD_MS) {
          gesture = null;
          return;
        }
        const axis = Math.abs(dy) >= Math.abs(dx) ? "y" : "x";
        const chain = scrollChain(g.target, axis);
        if (chain.length === 0) {
          // Nothing to scroll this way (e.g. a sideways swipe to change the day).
          gesture = null;
          return;
        }
        g.axis = axis;
        g.chain = chain;
        swallowClick = true;
      }
      const delta = g.axis === "y" ? g.lastY - e.clientY : g.lastX - e.clientX;
      scrollBy(g.chain, g.axis, delta);
      const dt = Math.max(1, e.timeStamp - g.lastT);
      g.velocity = 0.8 * (delta / dt) + 0.2 * g.velocity;
      g.lastX = e.clientX;
      g.lastY = e.clientY;
      g.lastT = e.timeStamp;
      e.preventDefault();
    };

    const onUp = (e: PointerEvent) => {
      const g = gesture;
      if (!g || g.id !== e.pointerId) return;
      gesture = null;
      if (!g.axis) return;
      // Glide on a little after a quick flick.
      let velocity = e.timeStamp - g.lastT > 80 ? 0 : g.velocity;
      let last = performance.now();
      const step = (now: number) => {
        const dt = now - last;
        last = now;
        velocity *= Math.pow(0.95, dt / 16);
        if (Math.abs(velocity) < 0.02) return;
        scrollBy(g.chain, g.axis!, velocity * dt);
        momentum = requestAnimationFrame(step);
      };
      if (Math.abs(velocity) > 0.1) momentum = requestAnimationFrame(step);
      window.setTimeout(() => (swallowClick = false), 0);
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
    return () => {
      stopMomentum();
      window.removeEventListener("pointerdown", onDown, { capture: true });
      window.removeEventListener("pointermove", onMove, { capture: true });
      window.removeEventListener("pointerup", onUp, { capture: true });
      window.removeEventListener("pointercancel", onUp, { capture: true });
      window.removeEventListener("click", onClick, { capture: true });
    };
  }, [prefs.kiosk]);

  return null;
}
