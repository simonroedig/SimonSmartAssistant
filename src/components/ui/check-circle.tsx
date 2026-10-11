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

const BUTTON: Record<CheckTone, string> = {
  accent: "bg-accent-soft hover:bg-accent/20",
  emerald: "bg-emerald-500/12 hover:bg-emerald-500/20",
  yellow: "bg-yellow-400/18 hover:bg-yellow-400/28 dark:bg-yellow-300/14 dark:hover:bg-yellow-300/22",
};

/**
 * Round, animated checkbox used in lists. Unticked it shows a faint tick, so
 * it reads as "tap to tick off".
 */
export function CheckCircle({
  checked,
  className,
  tone = "accent",
}: {
  checked: boolean;
  className?: string;
  tone?: CheckTone;
}) {
  const fill = FILL[tone];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "ui-check relative grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors duration-200",
        checked ? fill : "border-line-strong",
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
          className={cn("text-faint transition-opacity duration-200", checked ? "opacity-0" : "opacity-45")}
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
 * Tick off (or back on) from an item's sheet: the list's circle as a button,
 * next to Delete – so finishing and deleting are never mixed up.
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
    <Button
      size="icon"
      variant="soft"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn("[&_svg]:size-3.5", BUTTON[tone ?? "accent"])}
    >
      <CheckCircle checked={checked} tone={tone} />
    </Button>
  );
}
