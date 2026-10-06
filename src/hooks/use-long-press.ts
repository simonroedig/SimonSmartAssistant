"use client";

import { useRef } from "react";

/**
 * Long-press (and right-click) handler that doesn't break taps or scrolling.
 * Returns props to spread on the element and a function that tells whether the
 * last pointer sequence ended in a long press (so the click can be ignored).
 */
export function useLongPress(onLongPress: () => void, ms = 480) {
  const timer = useRef<number | undefined>(undefined);
  const fired = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const clear = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
  };

  const props = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      clear();
      timer.current = window.setTimeout(() => {
        fired.current = true;
        try {
          navigator.vibrate?.(12);
        } catch {
          // ignore
        }
        onLongPress();
      }, ms);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!start.current) return;
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      clear();
      fired.current = true;
      onLongPress();
    },
  };

  return { props, wasLongPress: () => fired.current };
}
