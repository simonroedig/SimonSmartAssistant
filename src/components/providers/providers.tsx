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
        offset={16}
        gap={8}
        toastOptions={{
          classNames: {
            toast: "!glass-strong !rounded-2xl !border-line !text-fg !shadow-pop !font-sans !text-[0.9rem] !px-4 !py-3",
            description: "!text-muted",
            actionButton: "!bg-accent !text-accent-fg !rounded-xl !font-semibold !px-3 !h-8",
          },
        }}
      />
    </QueryProvider>
  );
}
