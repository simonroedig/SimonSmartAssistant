"use client";

import { ClipboardPaste, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AutoTextarea, Input, Label } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { type MindItem, newId } from "@/data/core";
import { useAddMind, useDeleteMind, useUpdateMind } from "@/data/mind";
import { firstLink, type MindKind, parseMindList, videoInfo } from "@/lib/mind";
import { FIELD_FOCUS } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { MIND_TONE, ReminderCard } from "./mind-parts";

export type ItemSheetState = { kind: MindKind; item: MindItem | null } | null;

/** A card or a video: new, or to change. Closing in any way saves. */
export function ItemSheet({ state, onClose }: { state: ItemSheetState; onClose: () => void }) {
  // A fresh form per opening, kept while the sheet animates out.
  const [shown, setShown] = useState({ state, count: 0 });
  if (state && state !== shown.state) setShown({ state, count: shown.count + 1 });
  if (!shown.state) return null;
  const props = { item: shown.state.item, open: state !== null, onClose };
  return shown.state.kind === "card" ? (
    <CardForm key={shown.count} {...props} />
  ) : (
    <VideoForm key={shown.count} {...props} />
  );
}

type FormProps = { item: MindItem | null; open: boolean; onClose: () => void };

function useRemove(item: MindItem | null, what: string, onClose: () => void) {
  const remove = useDeleteMind();
  const add = useAddMind();
  return () => {
    if (!item) return;
    remove.mutate({ id: item.id });
    toast(`${what} deleted`, {
      action: {
        label: "Undo",
        onClick: () =>
          add.mutate([
            { id: item.id, kind: item.kind as MindKind, title: item.title, body: item.body, source: item.source, url: item.url },
          ]),
      },
    });
    onClose();
  };
}

function CardForm({ item, open, onClose }: FormProps) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [source, setSource] = useState(item?.source ?? "");
  const [handled, setHandled] = useState(false);
  const add = useAddMind();
  const update = useUpdateMind();
  const remove = useRemove(item, "Reminder", () => {
    setHandled(true);
    onClose();
  });
  const empty = !body.trim();

  const close = () => {
    if (!open) return;
    if (!handled) {
      const patch = { title: title.trim(), body: body.replace(/\s+$/, ""), source: source.trim() };
      if (!item) {
        if (!empty) add.mutate([{ id: newId(), kind: "card", url: null, ...patch }]);
      } else if (empty) {
        // Never silently: an emptied card stays as it was, and says so.
        if (title.trim() !== item.title || source.trim() !== item.source || item.body)
          toast.warning("A reminder needs a few words – it stays as it was.");
      } else if (patch.title !== item.title || patch.body !== item.body.replace(/\s+$/, "") || patch.source !== item.source) {
        update.mutate({ id: item.id, patch });
      }
    }
    onClose();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && close()}
      title={item ? "Reminder" : "New reminder"}
      className={FIELD_FOCUS.teal}
      size="half"
      footer={
        <>
          {item && (
            <Button variant="danger" size="icon" aria-label="Delete this reminder" onClick={remove}>
              <Trash2 />
            </Button>
          )}
          <Button variant="ghost" className="ml-auto" onClick={close}>
            {empty && !item ? "Cancel" : "Done"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="mind-body">The reminder</Label>
          <AutoTextarea
            id="mind-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Rest is part of the work. Do it for fun."
            autoFocus={!item}
            minRows={3}
            maxRows={14}
            maxLength={4000}
            className="font-serif text-[1.02rem]"
          />
          <p className="mt-1.5 px-1 text-xs text-faint">
            Mark words with <span className="font-mono">==two equals signs==</span> – they get highlighted.
          </p>
        </div>
        <div>
          <Label htmlFor="mind-title">Title (if any)</Label>
          <Input
            id="mind-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Two ways to see it"
            maxLength={200}
          />
        </div>
        <div>
          <Label htmlFor="mind-source">From (if you like)</Label>
          <Input
            id="mind-source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="A book, a person, a video …"
            maxLength={200}
          />
        </div>
        {!empty && (
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">How it looks</p>
            <ReminderCard card={{ title: title.trim(), body, source: source.trim() }} />
          </div>
        )}
      </div>
    </Sheet>
  );
}

function VideoForm({ item, open, onClose }: FormProps) {
  const [url, setUrl] = useState(item?.url ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [handled, setHandled] = useState(false);
  const add = useAddMind();
  const update = useUpdateMind();
  const remove = useRemove(item, "Video", () => {
    setHandled(true);
    onClose();
  });
  const link = firstLink(url);
  const typed = url.trim() !== "";
  const info = link ? videoInfo(link) : null;

  const close = () => {
    if (!open) return;
    if (!handled) {
      const patch = { title: title.trim(), body: body.replace(/\s+$/, ""), url: link };
      if (!link) {
        // Never silently: what was typed isn't a link, so nothing could be kept.
        if (typed || title.trim() || body.trim())
          toast.warning(item ? "Not changed – that isn't a link" : "Not saved – there's no link in it", {
            description: url.trim() || undefined,
          });
      } else if (!item) {
        add.mutate([{ id: newId(), kind: "video", source: "", ...patch }]);
      } else if (patch.url !== item.url || patch.title !== item.title || patch.body !== item.body.replace(/\s+$/, "")) {
        update.mutate({ id: item.id, patch });
      }
    }
    onClose();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && close()}
      title={item ? "Video" : "Pin a video"}
      className={FIELD_FOCUS.teal}
      footer={
        <>
          {item && (
            <Button variant="danger" size="icon" aria-label="Delete this video" onClick={remove}>
              <Trash2 />
            </Button>
          )}
          <Button variant="ghost" className="ml-auto" onClick={close}>
            {!typed && !item ? "Cancel" : "Done"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="mind-url">Link</Label>
          <Input
            id="mind-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a YouTube or TikTok link"
            inputMode="url"
            autoComplete="off"
            autoFocus={!item}
          />
          <p className={cn("mt-1.5 flex items-center gap-1.5 px-1 text-xs", link || !typed ? "text-faint" : "text-amber-600 dark:text-amber-300")}>
            {link ? (
              `${info?.label} · opens in its app or the browser`
            ) : typed ? (
              <>
                <TriangleAlert className="size-3.5 shrink-0" /> No link in it yet
              </>
            ) : (
              "A shared text works too – the link is picked out of it."
            )}
          </p>
        </div>
        <div>
          <Label htmlFor="mind-video-title">Title</Label>
          <Input
            id="mind-video-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What it's about"
            maxLength={200}
          />
        </div>
        <div>
          <Label htmlFor="mind-video-note">Why it helps (if you like)</Label>
          <AutoTextarea
            id="mind-video-note"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="A calmer way to look at things"
            minRows={2}
            maxRows={8}
            maxLength={4000}
          />
        </div>
      </div>
    </Sheet>
  );
}

const EXAMPLE = `# Two ways to see it
Plans change… 😔
Plans change!!! 😄
— A friend
---
# A video
https://youtu.be/…`;

/** Several at once: pasted as text, one block each, between lines of ---. */
export function PasteSheet({
  open,
  draft,
  onDraft,
  onClose,
  onAdded,
}: {
  open: boolean;
  /** Kept while the page is open (closing doesn't lose it). */
  draft: string;
  onDraft: (text: string) => void;
  onClose: () => void;
  onAdded: (kinds: MindKind[]) => void;
}) {
  const add = useAddMind();
  const items = parseMindList(draft);
  const cards = items.filter((i) => i.kind === "card").length;
  const videos = items.length - cards;
  const summary = [
    cards && `${cards} ${cards === 1 ? "reminder" : "reminders"}`,
    videos && `${videos} ${videos === 1 ? "video" : "videos"}`,
  ]
    .filter(Boolean)
    .join(" and ");
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Add several at once"
      description="One block each, between lines of ---"
      className={FIELD_FOCUS.teal}
      size="half"
      footer={
        <>
          <Button
            variant="primary"
            disabled={items.length === 0}
            className={cn("ui-action shadow-none", MIND_TONE.solid)}
            onClick={() => {
              add.mutate(items.map((i) => ({ ...i, id: newId() })));
              onAdded([...new Set(items.map((i) => i.kind))]);
              onDraft("");
              onClose();
            }}
          >
            <ClipboardPaste /> {items.length ? `Add ${summary}` : "Add"}
          </Button>
          <Button variant="ghost" className="ml-auto" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <AutoTextarea
          aria-label="Reminders and videos to add"
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          placeholder={EXAMPLE}
          minRows={9}
          maxRows={18}
          className="font-mono text-[0.85rem] leading-5"
        />
        <p className="px-1 text-xs leading-relaxed text-faint">
          A first line with <span className="font-mono"># …</span> is the title, a last line with{" "}
          <span className="font-mono">— …</span> says who it&apos;s from, a link on its own is a video.
        </p>
      </div>
    </Sheet>
  );
}
