"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOut, MapPin, MonitorSmartphone, Moon, ShieldCheck, Sparkles, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { clearPersistedCache } from "@/components/providers/query-provider";
import { useSession } from "@/components/providers/session-provider";
import { useSyncStatus } from "@/components/providers/realtime-provider";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { LocationSearch } from "@/components/weather/location-search";
import { type PlannerPreferences, useSettings, useSettingsRow, useUpdateSettings } from "@/data/settings";
import { useDevicePrefs } from "@/hooks/use-device-prefs";
import type { ScreensaverMode, ThemeMode } from "@/lib/device";
import { BUILD_ID } from "@/lib/env";
import type { SleepSchedule } from "@/lib/sleep";
import { createClient } from "@/lib/supabase/client";
import { formatLocationLong } from "@/lib/weather/open-meteo";
import { Passkeys } from "./passkeys";
import { LauncherSection } from "@/components/launcher/launcher-widgets";
import { BirthdaysSection, HolidaysSection, useCalendarPreferences } from "./calendar-settings";
import { NavigationSection } from "./navigation-settings";
import { Row, Section } from "./section";
import { SleepScheduleEditor } from "./sleep-schedule-editor";

export function SettingsView() {
  const { email } = useSession();
  const syncStatus = useSyncStatus();
  const queryClient = useQueryClient();
  const { settings, isLoading: settingsLoading } = useSettings();
  const row = useSettingsRow();
  const updateSettings = useUpdateSettings();
  const [device, setDevice] = useDevicePrefs();
  const [calendar, setCalendar, calendarLoading] = useCalendarPreferences();
  const [changingLocation, setChangingLocation] = useState(false);

  // Sleep edits are local first and saved shortly after the last tap.
  const [schedule, setSchedule] = useState<SleepSchedule>(settings.sleepSchedule);
  const dirty = useRef(false);
  const saveTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!dirty.current) setSchedule(settings.sleepSchedule);
  }, [settings.sleepSchedule]);

  const changeSchedule = (next: SleepSchedule) => {
    setSchedule(next);
    dirty.current = true;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      if (row.data) updateSettings.mutate({ current: row.data, sleepSchedule: next });
      dirty.current = false;
    }, 700);
  };

  const setPlanner = (patch: Partial<PlannerPreferences>) => {
    if (row.data) updateSettings.mutate({ current: row.data, planner: { ...settings.planner, ...patch } });
  };

  const signOut = async (scope: "local" | "global") => {
    await createClient().auth.signOut({ scope });
    queryClient.clear();
    clearPersistedCache();
    window.location.replace("/login");
  };

  return (
    <>
      <PageHeader title="Settings" subtitle={email ?? undefined} />
      <PageBody className="grid gap-4 xl:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Section icon={<MapPin />} title="Weather location" description="Used for the forecast and sunrise/sunset.">
            {settingsLoading ? (
              <div className="skeleton h-12" />
            ) : settings.location && !changingLocation ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{settings.location.name}</div>
                  <div className="text-sm text-muted">{formatLocationLong(settings.location)}</div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setChangingLocation(true)}>
                  Change
                </Button>
              </div>
            ) : (
              <LocationSearch
                onSelect={(location) => {
                  if (row.data) updateSettings.mutate({ current: row.data, location });
                  setChangingLocation(false);
                }}
              />
            )}
          </Section>

          <Section
            icon={<Moon />}
            title="Sleep schedule"
            description="Shown greyed out in your day plan, and used for the night mode of the wall display."
          >
            <SleepScheduleEditor value={schedule} onChange={changeSchedule} />
          </Section>

          <Section icon={<Timer />} title="Planner">
            <Row label="Snap to" hint="Grid when moving or resizing blocks">
              <Segmented
                size="sm"
                value={settings.planner.snap}
                onChange={(snap) => setPlanner({ snap })}
                options={[5, 10, 15, 30].map((v) => ({ value: v as PlannerPreferences["snap"], label: `${v} min` }))}
              />
            </Row>
            <Row label="New blocks last" hint="Default duration when you tap the timeline">
              <Segmented
                size="sm"
                value={settings.planner.defaultDuration}
                onChange={(defaultDuration) => setPlanner({ defaultDuration })}
                options={[30, 45, 60, 90].map((v) => ({ value: v, label: v < 60 ? `${v}m` : `${v / 60}h` }))}
              />
            </Row>
            <Row
              label="Show clock changes"
              hint="Marks the days of summer and winter time in the plan – the clocks change by themselves"
            >
              <Switch
                checked={calendar.clockChanges}
                onCheckedChange={(clockChanges) => setCalendar({ clockChanges })}
                label="Show clock changes"
                disabled={calendarLoading}
              />
            </Row>
          </Section>

          <HolidaysSection />
          <BirthdaysSection />
          <NavigationSection />
          <LauncherSection />
        </div>

        <div className="flex flex-col gap-4">
          <Section
            icon={<MonitorSmartphone />}
            title="This device"
            description="Stored only on this device – your wall display and phone can differ."
          >
            <Row label="Appearance" hint="Auto switches to dark at sunset">
              <Segmented
                size="sm"
                value={device.theme}
                onChange={(theme: ThemeMode) => setDevice({ theme })}
                options={[
                  { value: "auto", label: "Auto" },
                  { value: "system", label: "System" },
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                ]}
              />
            </Row>
            <Row label="Text size">
              <Segmented
                size="sm"
                value={device.scale}
                onChange={(scale) => setDevice({ scale })}
                options={[0.9, 1, 1.1, 1.2, 1.3].map((v) => ({ value: v, label: `${Math.round(v * 100)}%` }))}
              />
            </Row>
            <Row label="Wall display mode" hint="Hides the cursor, enables night mode and auto-updates">
              <Switch
                checked={device.kiosk}
                onCheckedChange={(kiosk) => setDevice({ kiosk })}
                label="Wall display mode"
              />
            </Row>
            <Row label="On-screen keyboard" hint="Built-in German keyboard for touch screens">
              <Switch
                checked={device.keyboard}
                onCheckedChange={(keyboard) => setDevice({ keyboard })}
                label="On-screen keyboard"
              />
            </Row>
            {device.kiosk && (
              <>
                <Row label="Night mode" hint="Dims to a calm clock when nobody touches the screen">
                  <Segmented
                    size="sm"
                    value={device.screensaver}
                    onChange={(screensaver: ScreensaverMode) => setDevice({ screensaver })}
                    options={[
                      { value: "off", label: "Off" },
                      { value: "night", label: "At night" },
                      { value: "always", label: "Always" },
                    ]}
                  />
                </Row>
                <Row label="Dim after">
                  <Segmented
                    size="sm"
                    value={device.screensaverDelay}
                    onChange={(screensaverDelay) => setDevice({ screensaverDelay })}
                    options={[1, 2, 5, 10, 30].map((v) => ({ value: v, label: `${v} min` }))}
                  />
                </Row>
              </>
            )}
            <Row label="Reduce effects" hint="Turns off blur and background animation (faster on a Raspberry Pi)">
              <Switch
                checked={device.reduceEffects}
                onCheckedChange={(reduceEffects) => setDevice({ reduceEffects })}
                label="Reduce effects"
              />
            </Row>
          </Section>

          <Section icon={<ShieldCheck />} title="Sign-in & security">
            <div className="mb-5">
              <div className="mb-2 font-medium">Passkeys</div>
              <Passkeys />
            </div>
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Button variant="secondary" onClick={() => void signOut("local")}>
                <LogOut /> Sign out
              </Button>
              <Button variant="danger" onClick={() => void signOut("global")}>
                Sign out everywhere
              </Button>
            </div>
          </Section>

          <Section icon={<Sparkles />} title="About">
            <Row label="Sync" hint="Changes appear on all devices instantly">
              <span className="text-sm font-medium text-muted capitalize">{syncStatus}</span>
            </Row>
            <Row label="Version">
              <span className="font-mono text-sm text-muted">{BUILD_ID.slice(0, 7)}</span>
            </Row>
            <Row label="Cached data" hint="Clear if something looks out of date">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  clearPersistedCache();
                  void queryClient.invalidateQueries();
                }}
              >
                Refresh all
              </Button>
            </Row>
          </Section>
        </div>
      </PageBody>
    </>
  );
}
