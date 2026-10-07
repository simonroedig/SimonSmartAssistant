import { AutoUpdate } from "@/components/kiosk/auto-update";
import { KeepAwake } from "@/components/kiosk/keep-awake";
import { Screensaver } from "@/components/kiosk/screensaver";
import { TouchScroll } from "@/components/kiosk/touch-scroll";
import { RealtimeProvider } from "@/components/providers/realtime-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth/session";

export default async function SignedInLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <SessionProvider value={{ userId: user.id, email: user.email }}>
      <RealtimeProvider>
        <AppShell>{children}</AppShell>
        <Screensaver />
        <AutoUpdate />
        <KeepAwake />
        <TouchScroll />
      </RealtimeProvider>
    </SessionProvider>
  );
}
