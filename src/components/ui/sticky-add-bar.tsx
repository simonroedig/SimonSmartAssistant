"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * List pages on phones: the "add" row sticks to the bottom of the screen, just
 * above the tab bar, where the thumb is – the list itself still starts at the
 * top. While the row floats over a long list, a strip of page background below
 * it hides the rows passing by. Larger screens keep the row where it is, and
 * `enabled={false}` (home cards) renders a plain wrapper.
 */
export function StickyAddBar({
  enabled = true,
  className,
  children,
}: {
  enabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  // Floating = the bar sits higher than its place in the list (marked right after it).
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      const a = bar.current?.getBoundingClientRect();
      const b = marker.current?.getBoundingClientRect();
      if (a && b) setStuck(b.top - a.bottom > 1);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [enabled]);

  if (!enabled) return <div className={className}>{children}</div>;
  return (
    <>
      <div
        ref={bar}
        data-floating={stuck || undefined}
        className={cn(
          "max-md:sticky max-md:bottom-(--tabbar-space) max-md:z-20 max-md:order-last max-md:-mx-2 max-md:mt-auto max-md:rounded-[1.4rem] max-md:border max-md:border-line max-md:bg-(--nav-bg) max-md:p-2 max-md:shadow-(--shadow-card)",
          "max-md:data-floating:after:absolute max-md:data-floating:after:-inset-x-8 max-md:data-floating:after:top-[calc(100%+1px)] max-md:data-floating:after:h-40 max-md:data-floating:after:bg-(--bg)",
          className,
        )}
      >
        {children}
      </div>
      <div ref={marker} aria-hidden="true" className="max-md:order-last" />
    </>
  );
}
