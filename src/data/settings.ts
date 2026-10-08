"use client";

import { useMemo } from "react";
import type { Json } from "@/lib/database.types";
import { DEFAULT_SLEEP_SCHEDULE, normalizeSleepSchedule, type SleepSchedule } from "@/lib/sleep";
import { createClient } from "@/lib/supabase/client";
import type { WeatherLocation } from "@/lib/weather/open-meteo";
import { queryKeys, useOptimisticMutation, type UserSettingsRow, useAppQuery } from "./core";

export type PlannerPreferences = {
  /** Drag/resize grid in minutes. */
  snap: 5 | 10 | 15 | 30;
  /** Length of a newly created block in minutes. */
  defaultDuration: number;
};

export type Settings = {
  location: WeatherLocation | null;
  sleepSchedule: SleepSchedule;
  planner: PlannerPreferences;
};

export const DEFAULT_PLANNER_PREFERENCES: PlannerPreferences = { snap: 15, defaultDuration: 60 };

function parseLocation(value: Json | null): WeatherLocation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.name !== "string" || typeof v.latitude !== "number" || typeof v.longitude !== "number") return null;
  return {
    name: v.name,
    region: typeof v.region === "string" ? v.region : null,
    country: typeof v.country === "string" ? v.country : null,
    latitude: v.latitude,
    longitude: v.longitude,
    timezone: typeof v.timezone === "string" ? v.timezone : null,
  };
}

function parsePlanner(value: Json): PlannerPreferences {
  const prefs = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const planner = (prefs.planner ?? {}) as Record<string, unknown>;
  const snap = [5, 10, 15, 30].includes(planner.snap as number)
    ? (planner.snap as PlannerPreferences["snap"])
    : DEFAULT_PLANNER_PREFERENCES.snap;
  const duration =
    typeof planner.defaultDuration === "number" && planner.defaultDuration >= 15 && planner.defaultDuration <= 240
      ? planner.defaultDuration
      : DEFAULT_PLANNER_PREFERENCES.defaultDuration;
  return { snap, defaultDuration: duration };
}

export function parseSettings(row: UserSettingsRow | null): Settings {
  if (!row) {
    return { location: null, sleepSchedule: DEFAULT_SLEEP_SCHEDULE, planner: DEFAULT_PLANNER_PREFERENCES };
  }
  return {
    location: parseLocation(row.location),
    sleepSchedule: normalizeSleepSchedule(row.sleep_schedule),
    planner: parsePlanner(row.preferences),
  };
}

/** Settings row of the signed-in user; created with defaults on first use. */
export function useSettingsRow() {
  return useAppQuery({
    queryKey: queryKeys.settings,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("user_settings").select("*").maybeSingle();
      if (error) throw error;
      if (data) return data;

      const { data: created, error: insertError } = await supabase
        .from("user_settings")
        .upsert({ preferences: {} }, { onConflict: "user_id", ignoreDuplicates: true })
        .select()
        .maybeSingle();
      if (insertError) throw insertError;
      if (created) return created;

      const { data: existing, error: retryError } = await supabase.from("user_settings").select("*").single();
      if (retryError) throw retryError;
      return existing;
    },
    staleTime: 60_000,
  });
}

export function useSettings(): { settings: Settings; isLoading: boolean; isError: boolean } {
  const query = useSettingsRow();
  // Parse once per row version: callers use the nested objects as effect dependencies.
  const settings = useMemo(() => parseSettings(query.data ?? null), [query.data]);
  return { settings, isLoading: query.isLoading, isError: query.isError };
}

type SettingsPatch = {
  location?: WeatherLocation | null;
  sleepSchedule?: SleepSchedule;
  planner?: PlannerPreferences;
};

export function useUpdateSettings() {
  return useOptimisticMutation<SettingsPatch & { current: UserSettingsRow }>({
    table: "user_settings",
    queryKey: queryKeys.settings,
    errorTitle: "Couldn't save settings",
    mutationFn: async ({ current, ...patch }) => {
      const update: Partial<UserSettingsRow> = {};
      if (patch.location !== undefined) update.location = patch.location as unknown as Json;
      if (patch.sleepSchedule) update.sleep_schedule = patch.sleepSchedule as unknown as NonNullable<Json>;
      if (patch.planner) {
        const prefs = (current.preferences ?? {}) as Record<string, Json>;
        update.preferences = { ...prefs, planner: patch.planner } as unknown as NonNullable<Json>;
      }
      const { error } = await createClient().from("user_settings").update(update).eq("user_id", current.user_id);
      if (error) throw error;
    },
    update: (data, { current, ...patch }) => {
      const row = (data ?? current) as UserSettingsRow;
      return {
        ...row,
        ...(patch.location !== undefined ? { location: patch.location as unknown as Json } : {}),
        ...(patch.sleepSchedule ? { sleep_schedule: patch.sleepSchedule as unknown as NonNullable<Json> } : {}),
        ...(patch.planner
          ? {
              preferences: {
                ...((row.preferences ?? {}) as Record<string, Json>),
                planner: patch.planner,
              } as unknown as NonNullable<Json>,
            }
          : {}),
      };
    },
  });
}
