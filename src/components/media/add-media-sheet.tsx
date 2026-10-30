"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AutoTextarea, Input, Label } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { CHIP, CHIP_IDLE, CHIP_ON } from "@/components/ui/chip";
import { type MediaTitle, newId } from "@/data/core";
import { type Found, lookUp, type MediaInput, useAddMedia, useUpdateMedia } from "@/data/media";
import {
  linkLabel,
  MEDIA_KINDS,
  type MediaKind,
  type MediaSource,
  type ParsedLine,
  parseMediaLine,
  sourcesOf,
  titleCase,
} from "@/lib/media";
import { FIELD_FOCUS, TOAST_TONE, TONE_STYLES } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { KIND_ICON, KIND_LABEL } from "./media-parts";
import { EpisodeLinkHint, EpisodeLinkStatus, LookUp } from "./title-sheet";

const fuchsia = TONE_STYLES.fuchsia;

const PLACEHOLDER: Record<MediaKind, string> = {
  series: "Paste a link to any episode",
  movie: "Paste the film's link",
  channel: "Name and link, e.g. ZDF https://…",
  link: "Paste a link",
};

export function AddMediaSheet({
  open,
  kind,
  media,
  onClose,
  onAdded,
}: {
  open: boolean;
  kind: MediaKind;
  media: MediaTitle[];
  onClose: () => void;
  /** Shows the tab of what was added. */
  onAdded: (kind: MediaKind) => void;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Add to Media"
      description="One link – or a whole list, one per line"
      size="lg"
    >
      {open && <AddForm initialKind={kind} media={media} onDone={onAdded} onClose={onClose} />}
    </Sheet>
  );
}

/**
 * An existing entry the new one is the same as: a series or film by its show or name (it
 * then just gets the link as another place to watch), a channel or link by its address.
 */
function sameAs(
  media: MediaTitle[],
  kind: MediaKind,
  title: string,
  found: Found | null,
  url?: string,
): MediaTitle | null {
  if (kind === "channel" || kind === "link") {
    return url ? (media.find((m) => m.kind === kind && sourcesOf(m.sources).some((s) => s.url === url)) ?? null) : null;
  }
  return (
    media.find(
      (m) =>
        m.kind === kind &&
        ((found?.tvmaze_id != null && m.tvmaze_id === found.tvmaze_id) ||
          m.title.trim().toLowerCase() === title.trim().toLowerCase()),
    ) ?? null
  );
}

function AddForm({
  initialKind,
  media,
  onDone,
  onClose,
}: {
  initialKind: MediaKind;
  media: MediaTitle[];
  onDone: (kind: MediaKind) => void;
  onClose: () => void;
}) {
  const add = useAddMedia();
  const update = useUpdateMedia();
  const [text, setText] = useState("");
  const [chosenKind, setChosenKind] = useState<MediaKind | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [seen, setSeen] = useState(false);
  const [busy, setBusy] = useState(false);

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const parsed = lines.map(parseMediaLine);
  const valid = parsed.filter((p): p is ParsedLine => p !== null);
  const many = lines.length > 1;
  const first = parsed[0] ?? null;
  // What the link looks like, unless picked by hand.
  const kind: MediaKind = chosenKind ?? first?.kind ?? initialKind;
  const lookupKind = kind === "series" || kind === "movie" ? kind : null;
  const guess = first?.name ?? (first?.query ? titleCase(first.query) : "");
  const shownName = name ?? (lookupKind && found ? found.title : guess);

  const done = (added: MediaKind, count: number, merged: number) => {
    toast(
      count === 0
        ? merged === 1
          ? "Already there – the link is kept with it"
          : "All of them are already there"
        : `${count === 1 ? "Added" : `${count} added`}${merged ? ` · ${merged} already there` : ""}`,
      { classNames: { toast: TOAST_TONE.fuchsia } },
    );
    onDone(added);
    onClose();
  };

  const addOne = () => {
    const title = shownName.trim() || (first ? linkLabel(first.source.url) : "");
    if (!title) return;
    const sources: MediaSource[] = first ? [first.source] : [];
    const existing = sameAs(media, kind, title, lookupKind ? found : null, first?.source.url);
    if (existing) {
      const current = sourcesOf(existing.sources);
      if (sources.length && !current.some((s) => s.url === sources[0].url)) {
        update.mutate({ id: existing.id, patch: { sources: [...current, ...sources] } });
      }
      return done(kind, 0, 1);
    }
    const input: MediaInput = {
      id: newId(),
      kind,
      title,
      year: (lookupKind && found?.year) || first?.year || null,
      tvmaze_id: kind === "series" ? (found?.tvmaze_id ?? null) : null,
      poster_url: lookupKind ? (found?.poster_url ?? null) : null,
      summary: lookupKind ? (found?.summary ?? null) : null,
      sources,
      watched: kind === "movie" && seen,
    };
    add.mutate([input]);
    done(kind, 1, 0);
  };

  /** A pasted list: each line is looked up on its own (the best match is taken). */
  const addMany = async () => {
    setBusy(true);
    const inputs: MediaInput[] = [];
    let merged = 0;
    for (const line of valid) {
      const lineKind = chosenKind ?? line.kind;
      const hit = lineKind === "series" || lineKind === "movie" ? await lookUp(lineKind, line.query, line.year) : null;
      const title = line.name ?? hit?.title ?? (line.query ? titleCase(line.query) : linkLabel(line.source.url));
      const existing =
        sameAs(media, lineKind, title, hit, line.source.url) ??
        sameAs(
          inputs.map((i) => ({ ...i, sources: i.sources }) as unknown as MediaTitle),
          lineKind,
          title,
          hit,
          line.source.url,
        );
      if (existing) {
        const current = sourcesOf(existing.sources);
        if (!current.some((s) => s.url === line.source.url)) {
          if (media.includes(existing)) {
            update.mutate({ id: existing.id, patch: { sources: [...current, line.source] } });
          } else {
            inputs.find((i) => i.id === existing.id)!.sources.push(line.source);
          }
        }
        merged++;
        continue;
      }
      inputs.push({
        id: newId(),
        kind: lineKind,
        title,
        year: hit?.year ?? line.year,
        tvmaze_id: lineKind === "series" ? (hit?.tvmaze_id ?? null) : null,
        poster_url: hit?.poster_url ?? null,
        summary: hit?.summary ?? null,
        sources: [line.source],
      });
    }
    if (inputs.length) add.mutate(inputs);
    setBusy(false);
    done(inputs[0]?.kind ?? valid[0]?.kind ?? kind, inputs.length, merged);
  };

  return (
    <form
      className={cn("media-tone flex flex-col gap-5", FIELD_FOCUS.fuchsia)}
      onSubmit={(e) => {
        e.preventDefault();
        if (many) void addMany();
        else addOne();
      }}
    >
      <div>
        <Label>What</Label>
        <div className="flex flex-wrap gap-1.5">
          {MEDIA_KINDS.map((k) => {
            const Icon = KIND_ICON[k];
            return (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => {
                  setChosenKind(k);
                  setFound(null);
                }}
                className={cn(CHIP, kind === k ? cn(fuchsia.soft, fuchsia.text, CHIP_ON) : CHIP_IDLE)}
              >
                <Icon className="size-4" />
                {KIND_LABEL[k]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label htmlFor="media-links">{many ? `${valid.length} links` : "Link"}</Label>
        <AutoTextarea
          id="media-links"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFound(null);
            setName(null);
          }}
          placeholder={PLACEHOLDER[kind]}
          minRows={1}
          maxRows={8}
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
        />
        {many && (
          <ul className="mt-2 flex flex-col gap-1">
            {parsed.map((p, i) => {
              const Icon = p ? KIND_ICON[chosenKind ?? p.kind] : Plus;
              return (
                <li key={i} className="flex items-center gap-2 px-1 text-sm">
                  <Icon className={cn("size-4 shrink-0", p ? fuchsia.text : "text-faint")} />
                  <span className={cn("min-w-0 truncate", !p && "text-faint line-through")}>
                    {p ? (p.name ?? (p.query ? titleCase(p.query) : linkLabel(p.source.url))) : lines[i]}
                  </span>
                  {p && <span className="shrink-0 text-xs text-faint">{KIND_LABEL[chosenKind ?? p.kind]}</span>}
                </li>
              );
            })}
          </ul>
        )}
        {kind === "series" && !many && (first ? <EpisodeLinkStatus url={first.source.url} /> : <EpisodeLinkHint />)}
      </div>

      {/* Once there is a link: the show (or film) it names – picked already, another one a search away. */}
      {!many && lookupKind && first && (
        <div>
          <Label>{lookupKind === "series" ? "Which show" : "Which film"}</Label>
          <LookUp
            key={`${lookupKind}-${guess}`}
            kind={lookupKind}
            initial={first?.name ?? first?.query ?? ""}
            year={first?.year ?? null}
            picked={found}
            autoPick
            onPick={(f) => {
              setFound(f);
              setName(null);
            }}
          />
        </div>
      )}

      {!many && (
        <div>
          <Label htmlFor="media-title">Name</Label>
          <Input
            id="media-title"
            value={shownName}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === "channel" ? "e.g. ZDF" : kind === "link" ? "e.g. yarrlist" : "Title"}
            maxLength={200}
          />
        </div>
      )}

      {!many && kind === "movie" && (
        <label className="flex items-center justify-between rounded-2xl px-4 py-3 well">
          <span className="font-medium">Already seen</span>
          <Switch checked={seen} onCheckedChange={setSeen} label="Already seen" />
        </label>
      )}

      <Button
        type="submit"
        size="lg"
        variant="primary"
        className={cn("ui-action shadow-[0_2px_6px_-2px_rgb(0_0_0/0.3)]", fuchsia.solid)}
        disabled={busy || (many ? valid.length === 0 : !(shownName.trim() || first))}
      >
        <Plus /> {busy ? "Adding…" : many ? `Add ${valid.length}` : "Add"}
      </Button>
    </form>
  );
}
