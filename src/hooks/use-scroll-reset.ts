"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * A view switched (another tab): it starts at its top, not where the last one was left –
 * the phone's scrolling part (put the ref on it) and the page.
 */
export function useScrollReset<T extends HTMLElement = HTMLDivElement>(view: string) {
  const ref = useRef<T>(null);
  const shown = useRef(view);
  useLayoutEffect(() => {
    if (shown.current === view) return;
    shown.current = view;
    if (ref.current) ref.current.scrollTop = 0;
    window.scrollTo({ top: 0 });
  }, [view]);
  return ref;
}
