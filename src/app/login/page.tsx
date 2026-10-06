import type { Metadata } from "next";
import { LoginView } from "@/components/auth/login-view";
import { fetchAuthCapabilities, NO_CAPABILITIES } from "@/lib/auth/capabilities";
import { safeNextPath } from "@/lib/auth/safe-next";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const capabilities = isSupabaseConfigured
    ? await fetchAuthCapabilities({ next: { revalidate: 300 } })
    : NO_CAPABILITIES;

  return (
    <LoginView
      capabilities={capabilities}
      next={safeNextPath(typeof params.next === "string" ? params.next : null)}
      error={typeof params.error === "string" ? params.error : undefined}
    />
  );
}
