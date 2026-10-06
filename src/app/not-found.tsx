import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-sm rounded-[2rem] p-8 text-center glass">
        <p className="text-6xl font-extralight tracking-tight text-faint">404</p>
        <h1 className="mt-3 text-xl font-semibold">Nothing here</h1>
        <p className="mt-1 text-muted">This page doesn&apos;t exist.</p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center rounded-2xl bg-accent px-5 font-medium text-accent-fg"
        >
          Back to the dashboard
        </Link>
      </div>
    </main>
  );
}
