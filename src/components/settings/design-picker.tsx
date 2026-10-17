"use client";

import { Check, ShoppingBasket } from "lucide-react";
import { DESIGNS } from "@/lib/designs";
import type { DesignId } from "@/lib/device";
import { TONE_STYLES } from "@/lib/tones";
import { cn } from "@/lib/utils";

/**
 * The designs side by side, each as a small live sample: the preview carries
 * its own data-design, so designs.css draws it with that design's parts.
 */
export function DesignPicker({ value, onChange }: { value: DesignId; onChange: (design: DesignId) => void }) {
  return (
    <div role="radiogroup" aria-label="Design" className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {DESIGNS.map((design) => {
        const active = design.id === value;
        return (
          <button
            key={design.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={design.name}
            onClick={() => onChange(design.id)}
            className={cn(
              "group flex flex-col gap-2 rounded-2xl p-1.5 text-left transition-colors",
              active ? "bg-accent-soft ring-2 ring-accent" : "hover:bg-surface-hover",
            )}
          >
            <span
              data-design={design.id}
              aria-hidden="true"
              className="design-preview relative flex h-28 w-full flex-col justify-end overflow-hidden rounded-xl p-2.5"
            >
              <span className="flex flex-col gap-2 rounded-(--radius-card) p-2.5 glass">
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "ui-badge grid size-6 shrink-0 place-items-center rounded-lg [&_svg]:size-3.5",
                      TONE_STYLES.emerald.soft,
                      TONE_STYLES.emerald.text,
                    )}
                  >
                    <ShoppingBasket />
                  </span>
                  <span className="ui-title truncate text-[0.8rem] font-semibold text-fg">Shopping</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="ui-check grid size-4 shrink-0 place-items-center rounded-full border-2 border-accent bg-accent text-accent-fg">
                    <Check className="size-2.5" strokeWidth={4} />
                  </span>
                  <span className="h-5 flex-1 rounded-lg well" />
                  <span className="ui-switch relative h-4 w-7 shrink-0 rounded-full border border-transparent bg-accent">
                    <span className="ui-thumb absolute top-0.5 right-0.5 size-2.5 rounded-full bg-white" />
                  </span>
                </span>
              </span>
            </span>
            <span className="px-1 pb-1">
              <span className="block text-sm font-semibold">{design.name}</span>
              <span className="block text-xs leading-snug text-muted">{design.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
