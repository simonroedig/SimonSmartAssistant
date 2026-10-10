"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { navItem } from "@/components/shell/nav-items";
import { Segmented } from "@/components/ui/segmented";
import { useSettings, useSettingsRow, useUpdateSettings } from "@/data/settings";
import {
  type NavigationPreferences,
  type NavStyle,
  type PhoneHome,
  phoneTabs,
  railItems,
  type SectionId,
  swap,
} from "@/lib/navigation";
import { TONE_STYLES } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { Row, Section } from "./section";

/**
 * A small copy of a menu: tap one section, then another, and they swap places.
 * Home stays where it is.
 */
function SwapPicker({
  label,
  items,
  axis,
  disabled,
  onSwap,
}: {
  label: string;
  items: (SectionId | "home")[];
  axis: "x" | "y";
  disabled: boolean;
  onSwap: (a: SectionId, b: SectionId) => void;
}) {
  const [picked, setPicked] = useState<SectionId | null>(null);
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex rounded-2xl p-1 well", axis === "x" ? "w-full" : "w-[5.25rem] flex-col")}
    >
      {items.map((id) => {
        const item = navItem(id);
        const Icon = item.icon;
        const isHome = id === "home";
        const selected = picked === id;
        return (
          <button
            key={id}
            type="button"
            disabled={disabled || isHome}
            aria-pressed={isHome ? undefined : selected}
            aria-label={isHome ? "Home (stays in place)" : item.label}
            onClick={() => {
              if (isHome) return;
              if (picked === null) setPicked(id);
              else {
                if (picked !== id) onSwap(picked, id);
                setPicked(null);
              }
            }}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[0.65rem] font-medium text-muted transition-colors",
              axis === "y" && "py-2.5",
              selected && "bg-surface-strong text-fg shadow-sm ring-2 ring-accent/60 ring-inset",
              !isHome && !selected && "hover:text-fg",
              disabled && !isHome && "opacity-60",
            )}
          >
            <Icon className={cn("size-5", TONE_STYLES[item.tone].text)} strokeWidth={1.9} />
            {item.label}
            {isHome && (
              <span aria-hidden="true" className="absolute bottom-0.5 h-[3px] w-4 rounded-full bg-accent/70" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Order of the menu, separately for the phone's tab bar and the side bar of PC and wall display. */
export function NavigationSection() {
  const { settings } = useSettings();
  const row = useSettingsRow();
  const update = useUpdateSettings();
  const nav = settings.navigation;
  const loading = !row.data;
  const set = (patch: Partial<NavigationPreferences>) => {
    if (row.data) update.mutate({ current: row.data, navigation: { ...nav, ...patch } });
  };

  return (
    <Section icon={<Menu />} title="Menu" description="Tap two items to swap them. Applies to all your devices.">
      <div className="flex flex-col gap-3 pb-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-medium">Phone</div>
          <Segmented
            size="sm"
            value={nav.phoneHome}
            onChange={(phoneHome: PhoneHome) => set({ phoneHome })}
            options={[
              { value: "middle", label: "Home in the middle" },
              { value: "left", label: "Home on the left" },
            ]}
          />
        </div>
        <SwapPicker
          label="Phone tab bar"
          items={phoneTabs(nav)}
          axis="x"
          disabled={loading}
          onSwap={(a, b) => set({ phone: swap(nav.phone, a, b) })}
        />
      </div>
      <Row label="PC & wall display" hint="The side bar, top to bottom – Home stays on top">
        <SwapPicker
          label="Side bar"
          items={railItems(nav)}
          axis="y"
          disabled={loading}
          onSwap={(a, b) => set({ rail: swap(nav.rail, a, b) })}
        />
      </Row>
      <Row label="Menu bar" hint="A floating card, or attached to the edges of the screen">
        <Segmented
          size="sm"
          value={nav.style}
          onChange={(style: NavStyle) => set({ style })}
          options={[
            { value: "floating", label: "Floating" },
            { value: "attached", label: "Attached" },
          ]}
        />
      </Row>
    </Section>
  );
}
