"use client";

import { RefreshCw } from "lucide-react";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-sm rounded-[2rem] p-8 text-center glass">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-1 text-muted">The dashboard hit an unexpected error.</p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-2xl bg-accent px-5 font-medium text-accent-fg"
        >
          <RefreshCw className="size-4" /> Try again
        </button>
      </div>
    </main>
  );
}
