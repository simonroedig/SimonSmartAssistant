import "server-only";
import { redirect } from "next/navigation";
import { isEmailAllowed } from "@/lib/auth/allowlist";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null };

/**
 * Verifies the session for server-rendered, signed-in pages. The proxy already
 * redirects signed-out visitors, but every protected entry point checks again.
 */
export async function requireUser(): Promise<SessionUser> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) redirect("/login");

  const email = typeof claims.email === "string" ? claims.email : null;
  if (!isEmailAllowed(email)) redirect("/login?error=not_allowed");

  return { id: claims.sub, email };
}

export { safeNextPath } from "@/lib/auth/safe-next";
