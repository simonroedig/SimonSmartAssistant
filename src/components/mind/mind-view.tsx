"use client";

import { ChevronLeft, ChevronRight, Quote, SquarePlay, Undo2, Wind } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useMotionValue, useTransform } from "motion/react";
import { type Ref, useMemo, useRef, useState } from "react";
import { TemplateView } from "@/components/notes/template-note";
import { FILL_BODY, FillPage, PageBody, PageHeader } from "@/components/shell/page-header";
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
import { type DayKey, formatDayMonth, formatDayMonthShort, formatWeekday, fromDayKey } from "@/lib/date";
import { dayShuffle, type MindKind } from "@/lib/mind";
import { isEntryEmpty, NOTE_TEMPLATES, readEntries, type TemplateEntry, templateContent } from "@/lib/note-templates";
import { positionAtStart } from "@/lib/ordering";
import { FIELD_FOCUS } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { ItemSheet, type ItemSheetState } from "./mind-sheets";
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
    phone && sheet === null,
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
        <PageHeader title="Mind" subtitle="What helps – reminders, videos, letting go" />
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
                <Reminders cards={cards} onOpen={(c) => open("card", c)} />
              ) : (
                <Videos videos={videos} onEdit={(v) => open("video", v)} />
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

function Empty({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <Card className="items-center gap-3 px-6 py-12 text-center">
      <Icon className={cn("size-10", MIND_TONE.text)} />
      <p className="max-w-sm text-sm text-muted">{text}</p>
    </Card>
  );
}

const sectionTitle = "mb-2 flex items-center gap-2 px-1 text-xs font-semibold tracking-wide text-faint uppercase";

/** The one for today on top of the stack (flip through the others), then all of them, small. */
function Reminders({ cards, onOpen }: { cards: MindItem[]; onOpen: (card: MindItem) => void }) {
  const today = useToday();
  if (cards.length === 0) {
    return <Empty icon={Quote} text="Keep what helps you here – a line you read, a thought that sticks. Add one with +." />;
  }
  return (
    <div className="flex flex-col gap-7">
      {today && <Deck cards={cards} today={today} onOpen={onOpen} />}
      <section>
        <h2 className={sectionTitle}>All reminders · {cards.length}</h2>
        {/* Small and side by side (columns of different heights): the list grows fast. */}
        <div className="columns-2 gap-2.5 md:columns-3 xl:columns-4">
          {cards.map((card) => (
            <div key={card.id} className="mb-2.5 break-inside-avoid">
              <ReminderCard card={card} clamp onOpen={() => onOpen(card)} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const iconButton =
  "grid size-9 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-hover hover:text-fg";

/**
 * A stack of cards, today's on top: swipe one aside (or use the arrows) and the next comes
 * up – left for the next, right for the one before; all of them, in a new order each day.
 */
function Deck({ cards, today, onOpen }: { cards: MindItem[]; today: DayKey; onOpen: (card: MindItem) => void }) {
  const order = useMemo(() => dayShuffle(cards, today), [cards, today]);
  // The card on top (null: today's); a gone one falls back to today's.
  const [at, setAt] = useState<string | null>(null);
  const [fly, setFly] = useState(-1);
  const index = Math.max(0, order.findIndex((c) => c.id === at));
  const card = order[index];
  const isToday = index === 0;
  const go = (step: 1 | -1) => {
    setFly(-step);
    setAt(order[(index + step + order.length) % order.length].id);
  };
  const day = fromDayKey(today);
  return (
    // Wide screens: a card's width, not a banner.
    <section className="mx-auto w-full max-w-2xl">
      <div className={cn(sectionTitle, "min-h-9 justify-between")}>
        <span className={cn("truncate", isToday && MIND_TONE.text)}>
          {isToday ? `For today · ${formatWeekday(day)}, ${formatDayMonth(day)}` : `${index + 1} of ${order.length}`}
        </span>
        {order.length > 1 && (
          <div className="-my-2 -mr-1.5 flex shrink-0 items-center tracking-normal normal-case">
            {!isToday && (
              <button
                type="button"
                onClick={() => {
                  setFly(1);
                  setAt(null);
                }}
                className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 transition-colors hover:bg-surface-hover hover:text-fg"
              >
                <Undo2 className="size-3.5" /> Today&apos;s
              </button>
            )}
            <button type="button" aria-label="Previous reminder" onClick={() => go(-1)} className={iconButton}>
              <ChevronLeft className="size-4.5" />
            </button>
            <button type="button" aria-label="Next reminder" onClick={() => go(1)} className={iconButton}>
              <ChevronRight className="size-4.5" />
            </button>
          </div>
        )}
      </div>
      {/* Its own sideways swipe: the page's (to the next tab) doesn't start here. */}
      <div data-swipe className={cn("relative", order.length > 1 && "pb-3")}>
        {order.length > 1 && (
          <>
            <div
              aria-hidden
              className="absolute inset-x-6 top-4 bottom-0 rounded-(--radius-card) border border-line bg-surface/45 shadow-(--shadow-card)"
            />
            <div
              aria-hidden
              className="absolute inset-x-3 top-2 bottom-1.5 rounded-(--radius-card) border border-line bg-surface/70"
            />
          </>
        )}
        <AnimatePresence mode="popLayout" initial={false} custom={fly}>
          <DeckCard
            key={card.id}
            card={card}
            today={isToday}
            canSwipe={order.length > 1}
            onSwipe={go}
            onOpen={() => onOpen(card)}
          />
        </AnimatePresence>
      </div>
    </section>
  );
}

const deckMotion = {
  enter: { opacity: 0, scale: 0.95, y: 10 },
  shown: { opacity: 1, scale: 1, y: 0, x: 0 },
  gone: (fly: number) => ({ opacity: 0, x: fly * 440, transition: { duration: 0.3, ease: "easeIn" as const } }),
};

/** The card on top: follows the finger (tilting a little); far or fast enough, it flies off. */
function DeckCard({
  ref,
  card,
  today,
  canSwipe,
  onSwipe,
  onOpen,
}: {
  ref?: Ref<HTMLDivElement>;
  card: MindItem;
  today: boolean;
  canSwipe: boolean;
  onSwipe: (step: 1 | -1) => void;
  onOpen: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 260], [-8, 8]);
  // A drag isn't a tap: no editing when the finger lets go.
  const draggedAt = useRef(0);
  return (
    <motion.div
      ref={ref}
      className="relative z-10"
      style={{ x, rotate }}
      variants={deckMotion}
      initial="enter"
      animate="shown"
      exit="gone"
      transition={{ duration: 0.25, ease: "easeOut" }}
      drag={canSwipe ? "x" : false}
      dragSnapToOrigin
      dragElastic={0.9}
      onDragEnd={(_, info) => {
        draggedAt.current = Date.now();
        const swing = info.offset.x + info.velocity.x * 0.2;
        if (Math.abs(swing) > 110) onSwipe(swing < 0 ? 1 : -1);
      }}
    >
      <ReminderCard
        card={card}
        large
        today={today}
        onOpen={() => Date.now() - draggedAt.current > 300 && onOpen()}
        className="cursor-grab active:cursor-grabbing"
      />
    </motion.div>
  );
}

function Videos({ videos, onEdit }: { videos: MindItem[]; onEdit: (video: MindItem) => void }) {
  if (videos.length === 0) {
    return (
      <Empty
        icon={SquarePlay}
        text="Pin the videos that help – a YouTube talk, a TikTok. Add one with +, a shared link is enough."
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
