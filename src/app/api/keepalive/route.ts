import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Called once a day by Vercel Cron (see vercel.json). Runs a tiny query so the
 * free Supabase project never gets paused for inactivity. Returns no data.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  if (!isSupabaseConfigured) return Response.json({ ok: false, reason: "not configured" }, { status: 500 });

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("keepalive");
  if (error) return Response.json({ ok: false }, { status: 502 });
  return Response.json({ ok: data === true }, { headers: { "Cache-Control": "no-store" } });
}
