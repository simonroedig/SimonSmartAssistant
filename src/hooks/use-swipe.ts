"use client";

import { useRef } from "react";
import { isFingerLike } from "@/lib/pointer";

const MIN_DISTANCE = 60;
const MAX_DURATION = 1500;

/**
 * Sideways swipe (finger, or the wall display's touch screen) on an element.
 * `onSwipe(1)` for a swipe to the left (next), `onSwipe(-1)` to the right
 * (previous). The tap that ends a swipe is swallowed. Spread the returned
 * handlers on the element; events from portals (sheets) are ignored, and so
 * are swipes on a nested element with its own swipe (marked `data-swipe`).
 */
export function useSwipe(onSwipe: (direction: 1 | -1) => void, enabled = true) {
  const start = useRef<{ id: number; x: number; y: number; t: number } | null>(null);
  const swallowClick = useRef(false);

  return {
    onPointerDownCapture: (e: React.PointerEvent) => {
      const owner = (e.target as Element).closest?.("[data-swipe]");
      const inside = e.currentTarget.contains(e.target as Node) && (!owner || owner === e.currentTarget);
      start.current =
        enabled && inside && isFingerLike(e.pointerType)
          ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp }
          : null;
    },
    onPointerUpCapture: (e: React.PointerEvent) => {
      const s = start.current;
      start.current = null;
      if (!s || s.id !== e.pointerId) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5 || e.timeStamp - s.t > MAX_DURATION) return;
      swallowClick.current = true;
      window.setTimeout(() => (swallowClick.current = false), 50);
      onSwipe(dx < 0 ? 1 : -1);
    },
    onPointerCancelCapture: () => {
      start.current = null;
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (!swallowClick.current) return;
      e.stopPropagation();
      e.preventDefault();
    },
  };
}
