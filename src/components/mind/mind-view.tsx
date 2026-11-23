"use client";

import { ClipboardPaste, Quote, Shuffle, SquarePlay, Wind } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { TemplateView } from "@/components/notes/template-note";
import { FILL_BODY, FillPage, PageBody, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CHIP, CHIP_IDLE, CHIP_ON } from "@/components/ui/chip";
import { Fab } from "@/components/ui/fab";
import type { MindItem, Note } from "@/data/core";
import { useMind } from "@/data/mind";
import { prepareNote, useAddNote, useNotes, useUpdateNote } from "@/data/notes";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useScrollToPressed } from "@/hooks/use-scroll-to-pressed";
import { useSwipe } from "@/hooks/use-swipe";
import { useToday } from "@/hooks/use-today";
import { formatDayMonthShort } from "@/lib/date";
import { cardOfTheDay, type MindKind } from "@/lib/mind";
import { isEntryEmpty, NOTE_TEMPLATES, readEntries, type TemplateEntry, templateContent } from "@/lib/note-templates";
import { positionAtStart } from "@/lib/ordering";
import { FIELD_FOCUS } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { ItemSheet, type ItemSheetState, PasteSheet } from "./mind-sheets";
import { MIND_TONE, ReminderCard, VideoTile } from "./mind-parts";

type MindTab = "cards" | "videos" | "letgo";
const TABS: MindTab[] = ["cards", "videos", "letgo"];
const TAB_LABEL: Record<MindTab, string> = { cards: "Reminders", videos: "Videos", letgo: "Let go" };
const TAB_ICON: Record<MindTab, LucideIcon> = { cards: Quote, videos: SquarePlay, letgo: Wind };
const LET_GO = NOTE_TEMPLATES.letgo;

/** Phones: the same spot as the other pages' + (above the tab bar); elsewhere in the corner. */
const FAB_PLACE =
  "fixed max-md:right-[calc(2rem+1px)] max-md:bottom-[calc(var(--page-bottom)+1rem+1px)] md:right-[calc(2*var(--gutter))] md:bottom-[calc(2*var(--gutter))]";

function tabFrom(value: string | undefined): MindTab {
  return TABS.includes(value as MindTab) ? (value as MindTab) : "cards";
}

/**
 * Mind: what helps in everyday life. Reminders as cards (one of them for today), pinned
 * videos, and "Let go" – a moment that keeps replaying, walked through and checked off.
 */
export function MindView({ initialTab }: { initialTab?: string }) {
  const mind = useMind();
  const all = useMemo(() => mind.data ?? [], [mind.data]);
  const cards = useMemo(() => all.filter((m) => m.kind === "card"), [all]);
  const videos = useMemo(() => all.filter((m) => m.kind === "video"), [all]);
  const [tab, setTab] = useState<MindTab>(tabFrom(initialTab));
  const [sheet, setSheet] = useState<ItemSheetState>(null);
  const [pasting, setPasting] = useState(false);
  const [pasteDraft, setPasteDraft] = useState("");

  // Let go is a note from a template behind the scenes (it used to live in Notes).
  const notes = useNotes();
  const addNote = useAddNote();
  const updateNote = useUpdateNote();
  const letGoNote = notes.data?.find((n) => n.template === LET_GO.id) ?? null;
  const letGoOpen = readEntries(letGoNote?.entries).filter((e) => !isEntryEmpty(e) && !e.done_at).length;
  const saveEntries = (entries: TemplateEntry[]) => {
    const content = templateContent(LET_GO, entries, formatDayMonthShort);
    if (letGoNote) updateNote.mutate({ id: letGoNote.id, patch: content });
    else
      addNote.mutate(
        prepareNote({
          title: LET_GO.name,
          body: content.body,
          template: LET_GO.id,
          entries: content.entries,
          position: positionAtStart((notes.data ?? []).filter((n) => !n.pinned)),
        }),
      );
  };

  const changeTab = (next: MindTab) => {
    setTab(next);
    // In the address, so reloading keeps the tab.
    window.history.replaceState(window.history.state, "", next === "cards" ? "/mind" : `/mind?tab=${next}`);
  };

  // The content slides in from the side the picked tab is on; phones swipe through the tabs.
  const [shown, setShown] = useState({ tab, direction: 1 });
  if (shown.tab !== tab) setShown({ tab, direction: TABS.indexOf(tab) < TABS.indexOf(shown.tab) ? -1 : 1 });
  const phone = useMediaQuery("(max-width: 767px)");
  const swipe = useSwipe(
    (direction) => {
      const next = TABS[TABS.indexOf(tab) + direction];
      if (next) changeTab(next);
    },
    phone && sheet === null && !pasting,
  );
  const row = useScrollToPressed(tab);
  const count: Record<MindTab, number> = { cards: cards.length, videos: videos.length, letgo: letGoOpen };

  const open = (kind: MindKind, item: MindItem | null) => setSheet({ kind, item });

  return (
    <FillPage>
      <div
        className="flex [touch-action:pan-y] flex-col overflow-x-clip max-md:min-h-0 max-md:flex-1 md:min-h-dvh"
        {...swipe}
      >
        <PageHeader
          title="Mind"
          subtitle="What helps – reminders, videos, letting go"
          actions={
            tab !== "letgo" && (
              <Button
                variant="secondary"
                size="sm"
                aria-label="Add several at once"
                title="Add several at once"
                onClick={() => setPasting(true)}
              >
                <ClipboardPaste />
              </Button>
            )
          }
        />
        <PageBody className={cn(FIELD_FOCUS.teal, FILL_BODY, "md:pb-28")}>
          <div
            ref={row}
            role="tablist"
            aria-label="Mind"
            data-swipe
            className="-mx-4 mb-4 no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0"
          >
            {TABS.map((k) => {
              const Icon = TAB_ICON[k];
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={tab === k}
                  onClick={() => changeTab(k)}
                  className={cn(
                    CHIP,
                    "md:h-10 md:px-4 md:text-[0.95rem]",
                    tab === k ? cn(MIND_TONE.soft, MIND_TONE.text, CHIP_ON) : CHIP_IDLE,
                  )}
                >
                  <Icon className="size-4" />
                  {TAB_LABEL[k]}
                  {count[k] > 0 && <span className="text-xs tabular opacity-60">{count[k]}</span>}
                </button>
              );
            })}
          </div>

          {/* Phones: this part scrolls (room at its end for the + button). */}
          <div className="relative [touch-action:pan-y] max-md:-mx-4 max-md:min-h-0 max-md:flex-1 max-md:overflow-y-auto max-md:overscroll-contain max-md:px-4 max-md:pb-24">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: shown.direction * 28 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {tab === "letgo" ? (
                notes.isPending ? (
                  <Skeletons />
                ) : (
                  <TemplateView
                    template={LET_GO}
                    note={letGoNote ?? NO_NOTE}
                    onChange={saveEntries}
                    fabClassName={cn(FAB_PLACE, MIND_TONE.solid)}
                  />
                )
              ) : mind.isPending ? (
                <Skeletons />
              ) : tab === "cards" ? (
                <Reminders cards={cards} onOpen={(c) => open("card", c)} onPaste={() => setPasting(true)} />
              ) : (
                <Videos videos={videos} onEdit={(v) => open("video", v)} onPaste={() => setPasting(true)} />
              )}
            </motion.div>
          </div>
        </PageBody>
      </div>

      {tab !== "letgo" && (
        <Fab
          aria-label={tab === "cards" ? "New reminder" : "Pin a video"}
          onClick={() => open(tab === "cards" ? "card" : "video", null)}
          className={cn(FAB_PLACE, MIND_TONE.solid)}
        />
      )}
      <ItemSheet state={sheet} onClose={() => setSheet(null)} />
      <PasteSheet
        open={pasting}
        draft={pasteDraft}
        onDraft={setPasteDraft}
        onClose={() => setPasting(false)}
        onAdded={(kinds) => kinds.length === 1 && changeTab(kinds[0] === "card" ? "cards" : "videos")}
      />
    </FillPage>
  );
}

/** Before Let go has its note: an empty one (made with the first entry). */
const NO_NOTE = { entries: [] } as unknown as Note;

function Skeletons() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skeleton h-36 rounded-(--radius-card)" />
      ))}
    </div>
  );
}

function Empty({ icon: Icon, text, onPaste }: { icon: LucideIcon; text: string; onPaste: () => void }) {
  return (
    <Card className="items-center gap-3 px-6 py-12 text-center">
      <Icon className={cn("size-10", MIND_TONE.text)} />
      <p className="max-w-sm text-sm text-muted">{text}</p>
      <Button variant="secondary" size="sm" onClick={onPaste}>
        <ClipboardPaste /> Add several at once
      </Button>
    </Card>
  );
}

const sectionTitle = "mb-2 flex items-center gap-2 px-1 text-xs font-semibold tracking-wide text-faint uppercase";

/** The one for today on top (another one on request), then all of them. */
function Reminders({
  cards,
  onOpen,
  onPaste,
}: {
  cards: MindItem[];
  onOpen: (card: MindItem) => void;
  onPaste: () => void;
}) {
  const today = useToday();
  const [picked, setPicked] = useState<string | null>(null);
  if (cards.length === 0) {
    return (
      <Empty
        icon={Quote}
        text="Keep what helps you here – a line you read, a thought that sticks. Add one with +."
        onPaste={onPaste}
      />
    );
  }
  const featured = cards.find((c) => c.id === picked) ?? (today ? cardOfTheDay(cards, today) : null);
  const another = () => {
    const others = cards.filter((c) => c.id !== featured?.id);
    if (others.length) setPicked(others[Math.floor(Math.random() * others.length)].id);
  };
  return (
    <div className="flex flex-col gap-6">
      {featured && (
        <section>
          <h2 className={cn(sectionTitle, "justify-between")}>
            <span className={MIND_TONE.text}>{picked ? "Another one" : "For today"}</span>
            {cards.length > 1 && (
              <button
                type="button"
                onClick={another}
                className="-my-2 flex h-9 items-center gap-1.5 rounded-xl px-2.5 tracking-normal normal-case transition-colors hover:bg-surface-hover hover:text-fg"
              >
                <Shuffle className="size-3.5" /> Another one
              </button>
            )}
          </h2>
          <motion.div
            key={featured.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <ReminderCard card={featured} large onOpen={() => onOpen(featured)} />
          </motion.div>
        </section>
      )}
      <section>
        <h2 className={sectionTitle}>All reminders · {cards.length}</h2>
        {/* Columns of different heights, like cards laid out on a table. */}
        <div className="columns-1 gap-3 sm:columns-2 2xl:columns-3">
          {cards.map((card) => (
            <div key={card.id} className="mb-3 break-inside-avoid">
              <ReminderCard card={card} onOpen={() => onOpen(card)} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Videos({
  videos,
  onEdit,
  onPaste,
}: {
  videos: MindItem[];
  onEdit: (video: MindItem) => void;
  onPaste: () => void;
}) {
  if (videos.length === 0) {
    return (
      <Empty
        icon={SquarePlay}
        text="Pin the videos that help – a YouTube talk, a TikTok. Add one with +, a shared link is enough."
        onPaste={onPaste}
      />
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {videos.map((video) => (
        <VideoTile key={video.id} video={video} onEdit={() => onEdit(video)} />
      ))}
    </div>
  );
}
