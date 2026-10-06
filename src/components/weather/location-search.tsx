"use client";

import { Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { useLocationSearch } from "@/data/weather";
import { formatLocationLong, type WeatherLocation } from "@/lib/weather/open-meteo";
import { cn } from "@/lib/utils";

/** City search powered by the free Open-Meteo geocoding API. */
export function LocationSearch({
  onSelect,
  autoFocus,
  className,
}: {
  onSelect: (location: WeatherLocation) => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(term), 300);
    return () => window.clearTimeout(id);
  }, [term]);

  const results = useLocationSearch(debounced);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          const first = results.data?.[0];
          if (first) onSelect(first);
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-faint" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search a city, e.g. München"
          className="pl-11"
          autoFocus={autoFocus}
          enterKeyHint="search"
          aria-label="Search location"
        />
        {results.isFetching && (
          <Loader2 className="absolute top-1/2 right-4 size-4 -translate-y-1/2 animate-spin text-faint" />
        )}
      </form>
      {results.data && results.data.length > 0 && (
        <ul className="flex flex-col gap-1">
          {results.data.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onSelect(r)}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-surface-hover"
              >
                <MapPin className="size-4 shrink-0 text-accent" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="block truncate text-xs text-muted">{formatLocationLong(r)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {debounced.trim().length >= 2 && results.data?.length === 0 && !results.isFetching && (
        <p className="px-3 text-sm text-muted">No places found.</p>
      )}
      {results.isError && <p className="px-3 text-sm text-danger">Search failed – check your connection.</p>}
    </div>
  );
}
