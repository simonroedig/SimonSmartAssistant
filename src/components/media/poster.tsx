"use client";

import { Film, Tv } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A title's poster (from TVmaze or Wikipedia), or – without one – a quiet tile
 * with its initials. Always 2:3, as posters are.
 */
export function Poster({
  src,
  title,
  kind,
  className,
}: {
  src: string | null;
  title: string;
  kind: "series" | "movie";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const Icon = kind === "series" ? Tv : Film;
  const initials = title
    .split(/\s+/)
    .filter((w) => /^[\p{L}\d]/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <div
      className={cn(
        "relative aspect-[2/3] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-fuchsia-500/25 via-violet-500/20 to-sky-500/20",
        className,
      )}
    >
      {src && !failed ? (
        // Plain <img>: posters come straight from TVmaze/Wikipedia (no image optimisation to pay for).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-fuchsia-700/70 dark:text-fuchsia-200/70">
          <Icon className="size-1/4 min-h-4 min-w-4" />
          <span className="text-[0.8em] font-semibold tracking-wide">{initials}</span>
        </div>
      )}
    </div>
  );
}
