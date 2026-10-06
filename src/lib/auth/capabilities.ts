import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

export type AuthCapabilities = { google: boolean; passkeys: boolean; email: boolean };

export const NO_CAPABILITIES: AuthCapabilities = { google: false, passkeys: false, email: true };

/** Which sign-in methods are enabled in Supabase (public endpoint, no secrets). */
export async function fetchAuthCapabilities(init?: RequestInit): Promise<AuthCapabilities> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      ...init,
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
    });
    if (!res.ok) return NO_CAPABILITIES;
    const body = (await res.json()) as {
      external?: Record<string, boolean>;
      passkeys_enabled?: boolean;
    };
    return {
      google: body.external?.google === true,
      passkeys: body.passkeys_enabled === true,
      email: body.external?.email !== false,
    };
  } catch {
    return NO_CAPABILITIES;
  }
}
