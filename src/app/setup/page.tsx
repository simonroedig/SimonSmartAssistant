import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Setup" };

/** Shown only until the Supabase environment variables are configured. */
export default function SetupPage() {
  if (isSupabaseConfigured) redirect("/");

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-xl rounded-[2rem] p-8 glass">
        <h1 className="text-2xl font-semibold tracking-tight">Almost there</h1>
        <p className="mt-2 text-muted">
          The app is deployed, but it doesn&apos;t know your Supabase project yet. Add these environment variables in
          Vercel (Project → Settings → Environment Variables) and redeploy:
        </p>
        <pre className="mt-5 overflow-x-auto rounded-2xl bg-surface-sunken p-4 font-mono text-sm leading-relaxed">
          {`NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
ALLOWED_EMAILS=you@example.com
CRON_SECRET=<random string>`}
        </pre>
        <p className="mt-4 text-sm text-muted">The step-by-step guide is in docs/SETUP.md in the repository.</p>
      </div>
    </main>
  );
}
