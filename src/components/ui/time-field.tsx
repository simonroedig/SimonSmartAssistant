"use client";

import { Minus, Plus } from "lucide-react";
import { Popover } from "radix-ui";
import { useState } from "react";
import { clamp, formatMinutes, MINUTES_PER_DAY } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * Touch-friendly time input: −/+ steppers around the value; tapping the value
 * opens a grid to jump to any hour and minute. Values past midnight
 * (≥ 24:00) are shown with a "+1" marker.
 */
export function TimeField({
  value,
  onChange,
  min = 0,
  max = MINUTES_PER_DAY,
  step = 15,
  label,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const minuteSteps = Array.from({ length: 60 / Math.max(step, 5) }, (_, i) => i * Math.max(step, 5));
  const nextDay = value >= MINUTES_PER_DAY;
  const dayOffset = nextDay ? MINUTES_PER_DAY : 0;
  const hour = Math.floor((value - dayOffset) / 60);
  const minute = (value - dayOffset) % 60;
  const allowsNextDay = max > MINUTES_PER_DAY;

  const set = (v: number) => onChange(clamp(v, min, max));
  const label24 = value === MINUTES_PER_DAY && !allowsNextDay ? "24:00" : formatMinutes(value);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <button
        type="button"
        aria-label={`${label ?? "Time"} earlier`}
        onClick={() => set(value - step)}
        disabled={value - step < min}
        className="grid size-11 place-items-center rounded-2xl bg-surface-sunken text-muted transition-colors hover:text-fg active:scale-95 disabled:opacity-35"
      >
        <Minus className="size-4" />
      </button>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={label ? `${label}: ${label24}` : label24}
            className="field relative h-11 min-w-24 flex-1 rounded-2xl px-3 text-lg font-semibold tracking-tight tabular transition-colors well hover:bg-surface-hover"
          >
            {label24}
            {nextDay && allowsNextDay && (
              <span className="absolute top-1 right-2 text-[0.6rem] font-semibold text-accent">+1</span>
            )}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            sideOffset={8}
            collisionPadding={12}
            className="data-[state=open]:animate-in z-[60] w-[19rem] rounded-3xl p-3 glass-strong"
          >
            {allowsNextDay && (
              <div className="mb-2 flex gap-1 rounded-2xl bg-surface-sunken p-1 text-xs font-semibold">
                {[0, MINUTES_PER_DAY].map((offset) => (
                  <button
                    key={offset}
                    type="button"
                    onClick={() => set(offset + hour * 60 + minute)}
                    className={cn(
                      "h-8 flex-1 rounded-xl transition-colors",
                      dayOffset === offset ? "bg-surface-strong text-fg shadow-sm" : "text-muted",
                    )}
                  >
                    {offset === 0 ? "Same day" : "After midnight"}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-6 gap-1">
              {Array.from({ length: 24 }, (_, h) => {
                const candidate = dayOffset + h * 60 + minute;
                const disabled = candidate < min || candidate > max;
                return (
                  <button
                    key={h}
                    type="button"
                    disabled={disabled}
                    onClick={() => set(candidate)}
                    className={cn(
                      "h-10 rounded-xl text-sm font-medium tabular transition-colors disabled:opacity-25",
                      h === hour ? "bg-accent text-accent-fg" : "hover:bg-surface-hover",
                    )}
                  >
                    {String(h).padStart(2, "0")}
                  </button>
                );
              })}
            </div>
            <div className="my-2 h-px bg-line" />
            <div className={cn("grid gap-1", minuteSteps.length > 6 ? "grid-cols-6" : "grid-cols-4")}>
              {minuteSteps.map((m) => {
                const candidate = dayOffset + hour * 60 + m;
                const disabled = candidate < min || candidate > max;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      set(candidate);
                      setOpen(false);
                    }}
                    className={cn(
                      "h-10 rounded-xl text-sm font-medium tabular transition-colors disabled:opacity-25",
                      m === minute ? "bg-accent text-accent-fg" : "hover:bg-surface-hover",
                    )}
                  >
                    :{String(m).padStart(2, "0")}
                  </button>
                );
              })}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <button
        type="button"
        aria-label={`${label ?? "Time"} later`}
        onClick={() => set(value + step)}
        disabled={value + step > max}
        className="grid size-11 place-items-center rounded-2xl bg-surface-sunken text-muted transition-colors hover:text-fg active:scale-95 disabled:opacity-35"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
