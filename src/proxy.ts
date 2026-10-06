import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isEmailAllowed } from "@/lib/auth/allowlist";
import type { Database } from "@/lib/database.types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/env";
import { buildContentSecurityPolicy, createNonce } from "@/lib/security/csp";

/** Paths that work without a session. Everything else requires sign-in. */
const PUBLIC_PATHS = ["/login", "/auth/", "/setup", "/api/keepalive", "/api/version"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p));
}

/**
 * Runs before every page request:
 *  1. issues a fresh CSP nonce,
 *  2. refreshes the Supabase session cookies,
 *  3. sends signed-out visitors to /login and blocks e-mails outside ALLOWED_EMAILS.
 * Pages and data access verify the session again on their own – this is only
 * the first gate.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const nonce = createNonce();
  const csp = buildContentSecurityPolicy({
    nonce,
    supabaseUrl: SUPABASE_URL,
    isDev: process.env.NODE_ENV === "development",
    https: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
  });

  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("content-security-policy", csp);
    return NextResponse.next({ request: { headers } });
  };

  const withSecurityHeaders = (res: NextResponse) => {
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };

  if (!isSupabaseConfigured) {
    if (pathname === "/setup" || pathname.startsWith("/api/")) return withSecurityHeaders(forward());
    return withSecurityHeaders(NextResponse.redirect(new URL("/setup", request.url)));
  }

  let response = forward();
  const noStoreHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = forward();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.assign(noStoreHeaders, headers);
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Validates the JWT (signature + expiry) and refreshes it when needed.
  // Do not put code between createServerClient and this call.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  const redirectTo = (url: URL) => {
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
    Object.entries(noStoreHeaders).forEach(([key, value]) => res.headers.set(key, value));
    return withSecurityHeaders(res);
  };

  if (!claims) {
    if (isPublicPath(pathname)) return withSecurityHeaders(response);
    if (pathname.startsWith("/api/")) {
      return withSecurityHeaders(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
    }
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
    return redirectTo(login);
  }

  if (!isEmailAllowed(typeof claims.email === "string" ? claims.email : null)) {
    await supabase.auth.signOut({ scope: "local" });
    if (pathname === "/login") return withSecurityHeaders(response);
    return redirectTo(new URL("/login?error=not_allowed", request.url));
  }

  if (pathname === "/login") return redirectTo(new URL("/", request.url));

  return withSecurityHeaders(response);
}

export const config = {
  matcher: [
    // Everything except build assets and static files from /public.
    "/((?!_next/static|_next/image|favicon.ico|icons/|weather/|kiosk/|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};
