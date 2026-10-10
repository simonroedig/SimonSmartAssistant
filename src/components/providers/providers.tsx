"use client";

import { Toaster } from "sonner";
import { OnScreenKeyboard } from "@/components/kiosk/on-screen-keyboard";
import { DeviceController } from "./device-controller";
import { QueryProvider } from "./query-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <DeviceController />
      {children}
      <OnScreenKeyboard />
      <Toaster
        position="top-center"
        // Below the status bar (phones; the Android app draws under it).
        offset={{ top: "calc(var(--safe-top, 0px) + 1rem)" }}
        mobileOffset={{ top: "calc(var(--safe-top, 0px) + 0.75rem)" }}
        gap={8}
        toastOptions={{
          classNames: {
            toast: "!glass-strong !rounded-2xl !border-line !text-fg !shadow-pop !font-sans !text-[0.9rem] !px-4 !py-3",
            description: "!text-muted",
            // In the colour of the section the toast belongs to (TOAST_TONE), else the accent.
            actionButton:
              "!bg-[var(--toast-action,var(--accent))] !text-[color:var(--toast-action-fg,var(--accent-fg))] !rounded-xl !font-semibold !px-3 !h-8",
          },
        }}
      />
    </QueryProvider>
  );
}
