"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The section's colour: green for shopping, yellow for the backlog. */
type CheckTone = "accent" | "emerald" | "yellow";

const FILL: Record<CheckTone, string> = {
  accent: "bg-accent border-accent text-white",
  emerald: "bg-emerald-500 border-emerald-500 text-white",
  // Light yellow: a dark tick reads better on it.
  yellow: "bg-yellow-400 border-yellow-400 text-yellow-950 dark:bg-yellow-300 dark:border-yellow-300",
};

/**
 * Round, animated checkbox used in lists. Unticked it shows a faint tick, so
 * it reads as "tap to tick off".
 */
export function CheckCircle({
  checked,
  className,
  tone = "accent",
  strong = false,
}: {
  checked: boolean;
  className?: string;
  tone?: CheckTone;
  /** Unticked, but with a clear grey tick (on a button rather than in a list). */
  strong?: boolean;
}) {
  const fill = FILL[tone];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "ui-check relative grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors duration-200",
        checked ? fill : strong ? "border-muted/70" : "border-line-strong",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-3.5">
        <path
          d="M5 12.5l4.2 4.2L19 7"
          fill="none"
          stroke="currentColor"
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            "transition-opacity duration-200",
            strong ? "text-muted" : "text-faint",
            checked ? "opacity-0" : strong ? "opacity-100" : "opacity-45",
          )}
        />
        <motion.path
          d="M5 12.5l4.2 4.2L19 7"
          fill="none"
          stroke="currentColor"
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        />
      </svg>
    </span>
  );
}

/**
 * Tick off (or back on) from an item's sheet, next to Delete – so finishing
 * and deleting are never mixed up. A plain button with the list's circle:
 * grey while open, filled in the section's colour once done (as in the list).
 */
export function CheckButton({
  checked,
  label,
  onClick,
  tone,
}: {
  checked: boolean;
  label: string;
  onClick: () => void;
  tone?: CheckTone;
}) {
  return (
    <Button variant="secondary" onClick={onClick} className="gap-2 pr-3.5 pl-3 [&_svg]:size-3">
      <CheckCircle checked={checked} tone={tone} strong className="size-5" />
      {label}
    </Button>
  );
}
