"use client";

import { createClient } from "@/lib/supabase/client";
import { type BlockedApp, nowIso, queryKeys, useAppQuery, useOptimisticMutation } from "./core";

/**
 * Apps blocked in the Android launcher (a self-limit). The app can only add
 * them – the database has no update or delete grant – so unblocking means
 * deleting the row in the Supabase dashboard.
 */
export function useBlockedApps(enabled = true) {
  return useAppQuery({
    queryKey: queryKeys.blockedApps,
    enabled,
    queryFn: async () => {
      const { data, error } = await createClient().from("blocked_apps").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useBlockApp() {
  return useOptimisticMutation<{ id: string; package: string; label: string }>({
    table: "blocked_apps",
    queryKey: queryKeys.blockedApps,
    errorTitle: "Couldn't block the app",
    mutationFn: async ({ id, package: pkg, label }) => {
      const { error } = await createClient().from("blocked_apps").insert({ id, package: pkg, label });
      // Already blocked (another device was quicker): nothing to do.
      if (error && error.code !== "23505") throw error;
    },
    update: (data, { id, package: pkg, label }) => {
      const list = (data ?? []) as BlockedApp[];
      if (list.some((b) => b.package === pkg)) return list;
      return [...list, { id, package: pkg, label, created_at: nowIso(), user_id: "" }];
    },
  });
}
