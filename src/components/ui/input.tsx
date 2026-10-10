"use client";

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "field h-12 w-full rounded-2xl px-4 text-[0.95rem] transition-colors outline-none well placeholder:text-faint focus:border-(--field-focus) focus:bg-surface-hover",
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "field min-h-24 w-full resize-none rounded-2xl px-4 py-3 text-[0.95rem] leading-relaxed transition-colors outline-none well placeholder:text-faint focus:border-(--field-focus) focus:bg-surface-hover",
          className,
        )}
        {...props}
      />
    );
  },
);

/** Textarea that grows with its content (up to `maxRows`, then it scrolls). */
export const AutoTextarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    minRows?: number;
    maxRows?: number;
    /** Plain text inside another surface (a note, a composer): no field of its own. */
    bare?: boolean;
  }
>(function AutoTextarea({ className, minRows = 1, maxRows = 12, bare = false, value, ...props }, ref) {
  const inner = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => inner.current!);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const line = parseFloat(style.lineHeight) || 24;
    const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    // Measuring needs height: auto for a moment; the list or sheet around it would
    // shrink and lose its scroll position (typing at the end of a long note jumped).
    const scrollers: [Element, number][] = [];
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (p.scrollHeight > p.clientHeight) scrollers.push([p, p.scrollTop]);
    }
    el.style.height = "auto";
    const min = line * minRows + padding + border;
    const max = line * maxRows + padding + border;
    el.style.height = `${Math.min(max, Math.max(min, el.scrollHeight + border))}px`;
    el.style.overflowY = el.scrollHeight + border > max ? "auto" : "hidden";
    for (const [p, top] of scrollers) p.scrollTop = top;
  }, [value, minRows, maxRows]);

  return (
    <textarea
      ref={inner}
      rows={minRows}
      value={value}
      className={cn(
        "w-full resize-none px-4 py-3 text-[0.95rem] leading-6 outline-none placeholder:text-faint",
        bare
          ? "bg-transparent"
          : "field rounded-2xl transition-colors well focus:border-(--field-focus) focus:bg-surface-hover",
        className,
      )}
      {...props}
    />
  );
});

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-2 block text-xs font-semibold tracking-wide text-muted uppercase", className)}
      {...props}
    />
  );
}
