"use client";

import { createClient } from "@/lib/supabase/client";
import { type Briefing, type BriefingSettings, nowIso, queryKeys, useAppQuery, useOptimisticMutation } from "./core";

/** The latest briefings, newest first (written each morning by the scheduled task). */
export function useBriefings() {
  return useAppQuery({
    queryKey: queryKeys.briefings,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("briefings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(14);
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

/** Opened: no longer shown as new – on every screen. */
export function useMarkBriefingRead() {
  return useOptimisticMutation<{ id: string }>({
    table: "briefings",
    queryKey: queryKeys.briefings,
    errorTitle: "Couldn't save that",
    mutationFn: async ({ id }) => {
      const { error } = await createClient().from("briefings").update({ read_at: nowIso() }).eq("id", id);
      if (error) throw error;
    },
    update: (data, { id }) =>
      ((data ?? []) as Briefing[]).map((b) => (b.id === id ? { ...b, read_at: b.read_at ?? nowIso() } : b)),
  });
}

/** The prompt and when the key was made – null until the briefing is set up. */
export function useBriefingSettings() {
  return useAppQuery({
    queryKey: queryKeys.briefingSettings,
    queryFn: async () => {
      const { data, error } = await createClient().from("briefing_settings").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useSaveBriefingPrompt() {
  return useOptimisticMutation<{ userId: string; prompt: string }>({
    table: "briefing_settings",
    queryKey: queryKeys.briefingSettings,
    errorTitle: "Couldn't save the prompt",
    mutationFn: async ({ userId, prompt }) => {
      const { error } = await createClient().from("briefing_settings").update({ prompt }).eq("user_id", userId);
      if (error) throw error;
    },
    update: (data, { prompt }) => (data ? { ...(data as BriefingSettings), prompt } : data),
  });
}

/** A new key for the scheduled task (the old one stops working). Shown once. */
export async function makeBriefingKey(): Promise<string> {
  const { data, error } = await createClient().rpc("briefing_new_key");
  if (error) throw error;
  return data;
}
