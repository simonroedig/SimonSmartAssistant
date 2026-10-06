/**
 * Public configuration. `NEXT_PUBLIC_*` values are inlined at build time, so they
 * must be read with their literal names.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// The publishable key (sb_publishable_…) is designed to be public. The legacy
// anon key works as a fallback for older projects.
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = SUPABASE_URL.length > 0 && SUPABASE_PUBLISHABLE_KEY.length > 0;

/** Identifies the running build so wall displays can reload after a deploy. */
export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
