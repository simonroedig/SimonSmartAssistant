"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { queryKeys, type SyncedTable } from "@/data/core";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "./session-provider";

export type SyncStatus = "connecting" | "live" | "reconnecting" | "offline";

const SyncStatusContext = createContext<SyncStatus>("connecting");

const TABLE_KEYS: Record<SyncedTable, readonly unknown[][]> = {
  user_settings: [[...queryKeys.settings]],
  shopping_items: [[...queryKeys.shopping], [...queryKeys.shoppingHistory]],
  todos: [[...queryKeys.todos]],
  plan_blocks: [[...queryKeys.blocks]],
  day_notes: [[...queryKeys.dayNotes]],
  notes: [[...queryKeys.notes]],
  birthdays: [[...queryKeys.birthdays]],
};

const TABLES = Object.keys(TABLE_KEYS) as SyncedTable[];
const RETRY_DELAYS = [1_000, 3_000, 10_000, 30_000];
/** A quick look at another app keeps the connection; longer away, it is let go. */
const HIDDEN_GRACE = 60_000;

/**
 * Streams database changes (from any device) into the local cache, so the wall
 * display updates the moment something is added on the phone.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const wasDisconnected = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    let attempt = 0;
    let retryTimer: number | undefined;
    let pauseTimer: number | undefined;
    // Off screen for a while (another app in front, screen off): nothing to keep up to date.
    let paused = false;

    const refresh = (table: SyncedTable) => {
      // Our own pending write will refetch when it settles; avoid flicker.
      if (queryClient.isMutating({ mutationKey: [table] }) > 0) return;
      TABLE_KEYS[table].forEach((queryKey) => void queryClient.invalidateQueries({ queryKey }));
    };

    const scheduleRetry = () => {
      window.clearTimeout(retryTimer);
      const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
      attempt += 1;
      retryTimer = window.setTimeout(() => void connect(), delay);
    };

    const connect = async () => {
      if (paused) return;
      if (channel) {
        await supabase.removeChannel(channel);
        channel = null;
      }
      // postgres_changes are filtered by RLS with the user's JWT. Make sure the
      // socket carries it *before* joining, otherwise we would join as "anon".
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        setStatus("offline");
        return;
      }
      await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;

      let next = supabase.channel(`sync-${userId}`);
      for (const table of TABLES) {
        next = next.on(
          "postgres_changes",
          { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
          () => refresh(table),
        );
      }
      // The server confirms (or rejects) the database subscription separately.
      next = next.on("system", {}, (payload: { status?: string; extension?: string; message?: string }) => {
        if (cancelled || payload.extension !== "postgres_changes") return;
        if (payload.status === "ok") {
          attempt = 0;
          setStatus("live");
          if (wasDisconnected.current) {
            // Catch up on everything that changed while we were disconnected.
            wasDisconnected.current = false;
            TABLES.forEach(refresh);
          }
        } else {
          console.warn("Realtime:", payload.message);
          wasDisconnected.current = true;
          setStatus("reconnecting");
          scheduleRetry();
        }
      });
      channel = next;

      next.subscribe((state, error) => {
        if (cancelled) return;
        if (state === "SUBSCRIBED") {
          // Joined; "live" is set once the database subscription is confirmed.
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
          if (error) console.warn("Realtime:", error.message);
          wasDisconnected.current = true;
          setStatus(navigator.onLine ? "reconnecting" : "offline");
          scheduleRetry();
        } else if (state === "CLOSED") {
          wasDisconnected.current = true;
        }
      });
    };

    void connect();

    const onOffline = () => {
      wasDisconnected.current = true;
      setStatus("offline");
    };
    const onOnline = () => {
      setStatus("reconnecting");
      attempt = 0;
      void connect();
    };
    // Hidden for longer than a moment: close the connection (no heartbeats, no
    // radio wake-ups). Back on screen it reconnects and catches up on what changed –
    // the cached lists stay visible meanwhile, only the values update.
    const onVisibility = () => {
      window.clearTimeout(pauseTimer);
      if (document.visibilityState === "hidden") {
        pauseTimer = window.setTimeout(() => {
          paused = true;
          wasDisconnected.current = true;
          window.clearTimeout(retryTimer);
          const leaving = channel;
          channel = null;
          // Close the socket right away (on its own it lingers for another ~50 s).
          void (leaving ? supabase.removeChannel(leaving) : Promise.resolve()).then(() => {
            if (paused) void supabase.realtime.disconnect();
          });
          setStatus("connecting");
        }, HIDDEN_GRACE);
      } else if (paused) {
        paused = false;
        attempt = 0;
        void connect();
      }
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(pauseTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return <SyncStatusContext.Provider value={status}>{children}</SyncStatusContext.Provider>;
}

export function useSyncStatus(): SyncStatus {
  return useContext(SyncStatusContext);
}
