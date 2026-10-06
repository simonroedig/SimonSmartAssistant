"use client";

import { Switch as RadixSwitch } from "radix-ui";
import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onCheckedChange,
  label,
  className,
  id,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  className?: string;
  id?: string;
}) {
  return (
    <RadixSwitch.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full border border-line bg-surface-sunken transition-colors data-[state=checked]:border-transparent data-[state=checked]:bg-accent",
        className,
      )}
    >
      <RadixSwitch.Thumb className="block size-6 translate-x-0.5 rounded-full bg-white shadow-md transition-transform duration-200 data-[state=checked]:translate-x-[1.3rem]" />
    </RadixSwitch.Root>
  );
}
