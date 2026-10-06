"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Round, animated checkbox used in lists. */
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
        "relative grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors duration-200",
        checked ? fill : "border-line-strong",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-3.5 text-white">
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
