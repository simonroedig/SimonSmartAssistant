import { cookies } from "next/headers";
import { AutoUpdate } from "@/components/kiosk/auto-update";
import { KeepAwake } from "@/components/kiosk/keep-awake";
import { Screensaver } from "@/components/kiosk/screensaver";
import { StillMode } from "@/components/kiosk/still-mode";
import { TouchScroll } from "@/components/kiosk/touch-scroll";
import { RealtimeProvider } from "@/components/providers/realtime-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { SkyController } from "@/components/providers/sky-controller";
import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth/session";
import { NAVIGATION_COOKIE, navigationFromCookie } from "@/lib/navigation";

export default async function SignedInLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  // The menu order chosen in Settings, so the first render already shows it.
  const navigation = navigationFromCookie((await cookies()).get(NAVIGATION_COOKIE)?.value);

  return (
    <SessionProvider value={{ userId: user.id, email: user.email }}>
      <RealtimeProvider>
        <AppShell initialNavigation={navigation}>{children}</AppShell>
        <SkyController />
        <Screensaver />
        <AutoUpdate />
        <KeepAwake />
        <StillMode />
        <TouchScroll />
      </RealtimeProvider>
    </SessionProvider>
  );
}
