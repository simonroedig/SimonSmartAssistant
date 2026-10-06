import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

/** OAuth (e.g. Google) lands here with a PKCE code that we trade for a session. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const login = new URL("/login", url.origin);
  login.searchParams.set("error", providerError ? "provider" : "callback");
  return NextResponse.redirect(login);
}
