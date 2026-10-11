"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  tone?: "accent" | "emerald";
}) {
  const fill = tone === "emerald" ? "bg-emerald-500 border-emerald-500" : "bg-accent border-accent";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "ui-check relative grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors duration-200",
        checked ? fill : "border-line-strong",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-3.5 text-white">
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
  tone?: "accent" | "emerald";
}) {
  return (
    <Button
      size="icon"
      variant="soft"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "[&_svg]:size-3.5",
        tone === "emerald" ? "bg-emerald-500/12 hover:bg-emerald-500/20" : "bg-accent-soft hover:bg-accent/20",
      )}
    >
      <CheckCircle checked={checked} tone={tone} />
    </Button>
  );
}
