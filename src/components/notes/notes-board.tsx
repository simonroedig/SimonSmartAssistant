"use client";

import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ClipboardPaste, Copy, Lock, Pencil, Pin, Plus, StickyNote, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Fab } from "@/components/ui/fab";
import { Card, CardHeader, CardMoreLink } from "@/components/ui/card";
import { AutoTextarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { SortableList } from "@/components/ui/sortable";
import { type Note, type NoteCategory, queryKeys } from "@/data/core";
import { categoryColor, useNoteCategories } from "@/data/note-categories";
import {
  isNoteEmpty,
  type NoteDraft,
  type NotePatch,
  prepareNote,
  useAddNote,
  useNotes,
  useTrashNotes,
  useUpdateNote,
  useVaultNotes,
} from "@/data/notes";
import { useVaultStatus } from "@/data/vault";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useLongPress } from "@/hooks/use-long-press";
import { useSwipe } from "@/hooks/use-swipe";
import { PALETTE } from "@/lib/palette";
import { positionAtStart, positionForMove } from "@/lib/ordering";
import { FIELD_FOCUS, TOAST_TONE, TONE_STYLES } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { lockVault, useVaultOpen } from "@/lib/vault";
import { formatDayMonthShort } from "@/lib/date";
import {
  NOTE_TEMPLATES,
  noteTemplate,
  TEMPLATE_IDS,
  templateContent,
  type TemplateEntry,
  type TemplateId,
} from "@/lib/note-templates";
import { afterSheetClosed } from "@/lib/history";
import {
  CategoryPicker,
  CategoriesSheet,
  CategorySheet,
  type CategorySheetState,
  CategoryTag,
  type NoteFilter,
  NotesTabs,
  VAULT_TONE,
} from "./note-categories";
import { TEMPLATE_TONE, TemplateIcon, TemplateTile, TemplateView } from "./template-note";
import { VaultPinSheet, type VaultPinMode } from "./vault-pin-sheet";

export function noteLabel(note: Pick<Note, "title" | "body">): string {
  const text = note.title?.trim() || note.body.trim().split("\n")[0];
  return text.length > 40 ? `${text.slice(0, 39)}…` : text;
}

/** A note as a card: optional title in bold, then the text. */
function NoteCard({
  note,
  category,
  onOpen,
  onTogglePin,
  lines = 8,
  className,
}: {
  note: Note;
  /** Its category, shown as a small tag (left out where the page already filters by it). */
  category?: NoteCategory;
  onOpen: () => void;
  onTogglePin?: () => void;
  /** 1: compact (the title and a line, or two lines) – pinned notes in the overview. */
  lines?: 1 | 3 | 8;
  className?: string;
}) {
  const compact = lines === 1;
  return (
    <div className={cn("group relative rounded-2xl paper transition-colors hover:border-line-strong", className)}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open note "${noteLabel(note)}"`}
        className={cn("block w-full px-4 pr-10 text-left", compact ? "py-2.5" : "py-3")}
      >
        {/* Long titles: at most two lines, then "…" (long words break instead of running out). */}
        {note.title && (
          <span
            className={cn(
              "text-[0.98rem] leading-snug font-semibold [overflow-wrap:anywhere]",
              compact ? "block truncate" : "mb-1 line-clamp-2",
            )}
          >
            {note.title}
          </span>
        )}
        {note.body && (
          <span
            className={cn(
              "block text-[0.92rem] leading-snug [overflow-wrap:anywhere] whitespace-pre-line text-muted",
              compact ? (note.title ? "truncate" : "line-clamp-2") : lines === 3 ? "line-clamp-3" : "line-clamp-8",
              !note.title && "text-fg",
            )}
          >
            {compact && note.title ? note.body.split("\n").find((l) => l.trim()) : note.body}
          </span>
        )}
        {category && <CategoryTag category={category} className="mt-2.5" />}
      </button>
      {onTogglePin ? (
        <button
          type="button"
          onClick={onTogglePin}
          aria-label={note.pinned ? "Unpin note" : "Pin note"}
          aria-pressed={note.pinned}
          className={cn(
            "absolute top-1.5 right-1.5 grid size-9 place-items-center rounded-xl transition-opacity",
            note.pinned
              ? "text-orange-500 dark:text-orange-300"
              : "text-faint opacity-60 group-hover:opacity-100 [@media(pointer:fine)]:opacity-0",
          )}
        >
          <Pin className={cn("size-4", note.pinned && "fill-current")} />
        </button>
      ) : (
        note.pinned && (
          <Pin className="absolute top-3.5 right-3.5 size-3.5 fill-current text-orange-500 dark:text-orange-300" />
        )
      )}
    </div>
  );
}

/** Where a note goes: a category (or none), or the vault. */
type Placement = { categoryId: string | null; vault: boolean };

type EditorState = { mode: "create"; placement: Placement } | { mode: "edit"; note: Note } | null;

/**
 * The vault stays open while you're in it – also when you switch to another
 * window or app – and locks when you leave it or the notes page (or when its
 * 30 minutes are up). Locking also drops its notes from memory.
 */
function useVaultGuard() {
  const open = useVaultOpen();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) queryClient.removeQueries({ queryKey: queryKeys.vaultNotes, exact: true });
  }, [open, queryClient]);

  useEffect(() => () => lockVault(), []);
}

/** A view's name in the browser history (so the back gesture leaves a category). */
function viewKey(view: NoteFilter): string {
  if (typeof view === "string") return view;
  return "category" in view ? `c:${view.category}` : `t:${view.template}`;
}

function viewFromKey(key: unknown): NoteFilter | null {
  if (typeof key !== "string") return null;
  if (key.startsWith("c:")) return { category: key.slice(2) };
  if (key.startsWith("t:") && noteTemplate(key.slice(2))) return { template: key.slice(2) as TemplateId };
  return null;
}

/**
 * Notes as an overview with a level below it (page), or as a scrollable list (home card).
 * The page starts with All: pinned notes, what isn't sorted yet, and every category –
 * and each template's collection, striped – as a tile with a peek. A tile opens it, a
 * level deeper; back (the arrow, the back gesture or a swipe to the right) returns.
 */
export function NotesBoard({
  variant = "page",
  limit,
  className,
}: {
  variant?: "page" | "card";
  /** Home card on phones: only the first notes, no inner scrolling – the rest is on the page. */
  limit?: number;
  className?: string;
}) {
  const notes = useNotes();
  const vaultNotes = useVaultNotes();
  const categories = useNoteCategories();
  const vaultStatus = useVaultStatus();
  const vaultOpen = useVaultOpen();
  const add = useAddNote();
  const update = useUpdateNote();
  const trash = useTrashNotes();
  const [editor, setEditor] = useState<EditorState>(null);
  // Every visit starts with the overview.
  const [view, setViewState] = useState<NoteFilter>("all");
  const [categorySheet, setCategorySheet] = useState<CategorySheetState>(null);
  const [managing, setManaging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pinSheet, setPinSheet] = useState<VaultPinMode | null>(null);

  const inVault = variant === "page" && view === "vault";
  if (view === "vault" && !vaultOpen) setViewState("all"); // Locked meanwhile (idle, another tab…).
  useVaultGuard();

  const categoryList = useMemo(() => categories.data ?? [], [categories.data]);
  const byId = useMemo(() => new Map(categoryList.map((c) => [c.id, c])), [categoryList]);
  const everything = useMemo(() => notes.data ?? [], [notes.data]);
  // A template's collection is one note behind the scenes, but never shows as one.
  const board = useMemo(() => everything.filter((n) => !n.template), [everything]);
  const collections = useMemo(
    () =>
      TEMPLATE_IDS.flatMap((id) => {
        const note = everything.find((n) => n.template === id);
        return note ? [{ template: NOTE_TEMPLATES[id], note }] : [];
      }),
    [everything],
  );
  const vaultList = useMemo(() => (vaultOpen ? (vaultNotes.data ?? []) : []), [vaultOpen, vaultNotes.data]);
  const openCategory = typeof view === "object" && "category" in view ? view.category : null;
  const openTemplate = typeof view === "object" && "template" in view ? view.template : null;
  const collection = collections.find((c) => c.template.id === openTemplate) ?? null;
  const deeper = openCategory !== null || openTemplate !== null;

  // --- Going a level deeper, and back -------------------------------------------
  // A level deeper has its own history entry: the phone's back gesture returns to All.
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    const onPop = () => {
      const fromHistory = viewFromKey(window.history.state?.notesView);
      if (fromHistory) setViewState(fromHistory);
      else if (typeof viewRef.current === "object") setViewState("all");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const enter = (next: NoteFilter) => {
    if (view === "vault") lockVault();
    if (typeof next === "object") {
      const state = { notesView: viewKey(next) };
      if (window.history.state?.notesView) window.history.replaceState(state, "");
      else window.history.pushState(state, "");
    }
    setViewState(next);
  };
  const back = () => {
    if (window.history.state?.notesView) window.history.back();
    else setViewState("all");
  };

  // Gone meanwhile (deleted here or on another device) – not one just being added.
  const saving = useIsMutating({ mutationKey: ["note_categories"] }) + useIsMutating({ mutationKey: ["notes"] }) > 0;
  if (!saving && openCategory && categories.data && !byId.has(openCategory)) setViewState("all");
  if (!saving && openTemplate && notes.data && !collection) setViewState("all");

  const shown = useMemo(() => {
    if (variant === "card") return board;
    if (view === "vault") return vaultList;
    if (openCategory) return board.filter((n) => n.category_id === openCategory);
    return board;
  }, [variant, view, openCategory, board, vaultList]);
  const pinned = shown.filter((n) => n.pinned);
  const others = shown.filter((n) => !n.pinned);

  // New notes land where the page is: in the vault, or in the category it shows.
  const here: Placement = { categoryId: openCategory, vault: view === "vault" };

  /** The list a note belongs to (positions are counted there). */
  const listOf = (vault: boolean) => (vault ? vaultList : everything);

  const create = (draft: NoteDraft, pin = false, placement: Placement = here) => {
    if (isNoteEmpty(draft)) return;
    const group = listOf(placement.vault).filter((n) => n.pinned === pin);
    add.mutate(prepareNote({ ...draft, ...placement, pinned: pin, position: positionAtStart(group) }));
    if (placement.vault && !vaultOpen) toast("Added to the vault", { icon: <Lock className="size-4" /> });
  };

  // Deleting moves a note to the trash (see NotesTrashButton); undo brings it right back.
  const deleteWithUndo = (note: Note, label = noteLabel(note)) => {
    trash.mutate({ ids: [note.id], trash: true });
    toast(`Moved "${label}" to the trash`, {
      action: { label: "Undo", onClick: () => trash.mutate({ ids: [note.id], trash: false }) },
      classNames: { toast: TOAST_TONE.orange },
      duration: 6000,
    });
  };

  const togglePin = (note: Note) => {
    const group = listOf(note.vault).filter((n) => n.pinned !== note.pinned);
    update.mutate({ id: note.id, patch: { pinned: !note.pinned, position: positionAtStart(group) } });
  };

  const save = (note: Note, draft: NoteDraft, placement: Placement) => {
    if (isNoteEmpty(draft)) {
      deleteWithUndo(note);
      return;
    }
    const patch: NotePatch = {};
    const title = draft.title.trim() || null;
    const body = draft.body.replace(/\s+$/, "");
    if (title !== note.title) patch.title = title;
    if (body !== note.body) patch.body = body;
    const categoryId = placement.vault ? null : placement.categoryId;
    if (categoryId !== (note.category_id ?? null)) patch.category_id = categoryId;
    if (placement.vault !== note.vault) {
      patch.vault = placement.vault;
      // At the top of where it goes.
      patch.position = positionAtStart(listOf(placement.vault).filter((n) => n.pinned === note.pinned));
    }
    if (Object.keys(patch).length > 0) update.mutate({ id: note.id, patch });
    if (patch.vault === true && !inVault) toast("Moved to the vault", { icon: <Lock className="size-4" /> });
  };

  /** A template's collection: made once, then opened. */
  const startCollection = (id: TemplateId) => {
    if (!collections.some((c) => c.template.id === id)) {
      add.mutate(
        prepareNote({
          title: NOTE_TEMPLATES[id].name,
          body: "",
          template: id,
          entries: [],
          position: positionAtStart(everything.filter((n) => !n.pinned)),
        }),
      );
    }
    enter({ template: id });
  };
  const saveEntries = (note: Note, entries: TemplateEntry[]) => {
    const template = noteTemplate(note.template);
    if (!template) return;
    update.mutate({ id: note.id, patch: templateContent(template, entries, formatDayMonthShort) });
  };

  const openVault = () => {
    if (view === "vault") enter("all");
    else if (vaultOpen) enter("vault");
    else setPinSheet(vaultStatus.data?.hasPin === false ? "setup" : "unlock");
  };

  // The content slides in from the side it comes from: the vault on the left, deeper on the right.
  const order = ["vault", "all", "deeper"];
  const key = deeper ? "deeper" : (view as string);
  const [slide, setSlide] = useState({ key: viewKey(view), direction: 1 });
  if (slide.key !== viewKey(view)) {
    const from = slide.key.includes(":") ? "deeper" : slide.key;
    setSlide({ key: viewKey(view), direction: order.indexOf(key) < order.indexOf(from) ? -1 : 1 });
  }

  // Phones: a swipe to the right goes back (from a category) or into the vault (from All);
  // to the left from the vault back to All.
  const phone = useMediaQuery("(max-width: 767px)");
  const swipe = useSwipe(
    (direction) => {
      if (deeper) {
        if (direction === -1) back();
      } else if (view === "all" && direction === -1) openVault();
      else if (view === "vault" && direction === 1) enter("all");
    },
    variant === "page" &&
      phone &&
      editor === null &&
      categorySheet === null &&
      pinSheet === null &&
      !managing &&
      !importing,
  );

  const editorSheet = (
    <NoteEditor
      state={editor}
      categories={categoryList}
      vaultAvailable={vaultStatus.data?.hasPin === true}
      onClose={() => setEditor(null)}
      onCreate={create}
      onSave={save}
      onDelete={deleteWithUndo}
      onTogglePin={togglePin}
    />
  );

  const loading = (inVault ? vaultNotes.isLoading : notes.isLoading) && shown.length === 0;
  const tagFor = (note: Note) => (note.category_id ? byId.get(note.category_id) : undefined);

  if (variant === "card") {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader
          icon={<StickyNote />}
          title="Notes"
          tone="orange"
          count={shown.length}
          href="/notes"
          actions={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="New note"
              onClick={() => setEditor({ mode: "create", placement: { categoryId: null, vault: false } })}
            >
              <Plus />
            </Button>
          }
        />
        <div className={cn("px-4 pb-4", !limit && "min-h-0 flex-1 overflow-y-auto")}>
          {loading ? (
            <div className="flex flex-col gap-2">
              <div className="skeleton h-16" />
              <div className="skeleton h-16" />
            </div>
          ) : shown.length === 0 ? (
            <button
              type="button"
              onClick={() => setEditor({ mode: "create", placement: { categoryId: null, vault: false } })}
              className="flex w-full flex-col items-center gap-2 py-6 text-center text-muted"
            >
              <StickyNote className="size-8 text-faint" />
              <span className="text-sm">Jot something down – codes, ideas, lists.</span>
            </button>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {(limit ? shown.slice(0, limit) : shown).map((note) => (
                  <li key={note.id}>
                    <NoteCard
                      note={note}
                      category={tagFor(note)}
                      lines={3}
                      onOpen={() => setEditor({ mode: "edit", note })}
                    />
                  </li>
                ))}
              </ul>
              {limit && shown.length > limit && (
                <CardMoreLink href="/notes" tone="orange">
                  {shown.length - limit} more
                </CardMoreLink>
              )}
            </>
          )}
        </div>
        {editorSheet}
      </Card>
    );
  }

  // Two side by side already on phones (like Keep), so more fit on the screen.
  const grid = "grid grid-cols-2 items-start gap-2.5 sm:gap-3 lg:grid-cols-3 2xl:grid-cols-4";
  const tiles = "grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 2xl:grid-cols-4";
  const sectionTitle = "mb-2 px-1 text-xs font-semibold tracking-wide text-faint uppercase";
  const sortable = (items: Note[], lines: 1 | 3 | 8 = 8, tags = true) => (
    <SortableList
      items={items}
      layout="grid"
      withHandle={false}
      className={grid}
      onMove={(id, index) => update.mutate({ id, patch: { position: positionForMove(items, id, index) } })}
    >
      {(note) => (
        <NoteCard
          note={note}
          category={tags ? tagFor(note) : undefined}
          lines={lines}
          onOpen={() => setEditor({ mode: "edit", note })}
          onTogglePin={() => togglePin(note)}
        />
      )}
    </SortableList>
  );

  const category = openCategory ? byId.get(openCategory) : undefined;
  const missingTemplates = TEMPLATE_IDS.filter((id) => !collections.some((c) => c.template.id === id)).map(
    (id) => NOTE_TEMPLATES[id],
  );

  // All: pinned (only those without a category – the others are pinned in theirs),
  // then what isn't sorted yet, then the categories.
  const overview = () => {
    const loose = board.filter((n) => !n.category_id);
    const loosePinned = loose.filter((n) => n.pinned);
    const unsorted = loose.filter((n) => !n.pinned);
    return (
      <div className="mt-2 flex flex-col gap-6 md:mt-6">
        {loosePinned.length > 0 && (
          <section>
            <h2 className={sectionTitle}>Pinned</h2>
            {sortable(loosePinned, 1)}
          </section>
        )}
        {unsorted.length > 0 && (
          <section>
            <h2 className={sectionTitle}>Not sorted yet</h2>
            {sortable(unsorted, 3)}
          </section>
        )}
        <section>
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <h2 className="text-xs font-semibold tracking-wide text-faint uppercase">Categories</h2>
            {categoryList.length > 1 && (
              <button
                type="button"
                aria-label="Edit categories"
                title="Order and edit the categories"
                onClick={() => setManaging(true)}
                className="-my-2 -mr-2 grid size-9 place-items-center rounded-xl text-faint transition-colors hover:bg-surface-hover hover:text-fg"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
          </div>
          <ul className={tiles}>
            {collections.map(({ template, note }) => (
              <li key={template.id}>
                <TemplateTile template={template} note={note} onOpen={() => enter({ template: template.id })} />
              </li>
            ))}
            {categoryList.map((c) => (
              <li key={c.id}>
                <CategoryTile
                  category={c}
                  notes={board.filter((n) => n.category_id === c.id)}
                  onOpen={() => enter({ category: c.id })}
                  onEdit={() => setCategorySheet({ mode: "edit", category: c })}
                />
              </li>
            ))}
            <li>
              <button
                type="button"
                aria-label="New category"
                onClick={() => setCategorySheet({ mode: "create" })}
                className="flex h-full min-h-28 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong text-sm font-medium text-muted transition-colors hover:bg-surface-hover hover:text-fg"
              >
                <Plus className="size-5" />
                New category
              </button>
            </li>
          </ul>
        </section>
        <p className="text-center text-xs text-faint">
          Tap a category to open it · press and hold one to edit it, a note to move it.
        </p>
      </div>
    );
  };

  // A category, the vault: its pinned notes first, then the rest.
  const list = () =>
    shown.length === 0 ? (
      <div className="flex flex-col items-center gap-2 py-16 text-center text-muted">
        {inVault ? <Lock className="size-10 text-faint" /> : <StickyNote className="size-10 text-faint" />}
        <p className="text-sm">
          {inVault
            ? "Nothing in the vault yet. Notes here only open with your PIN."
            : `No notes in ${category?.name ?? "this category"} yet.`}
        </p>
      </div>
    ) : (
      <div className={cn("flex flex-col gap-6", inVault ? "mt-4" : "mt-2 md:mt-6")}>
        {pinned.length > 0 && (
          <section>
            <h2 className={sectionTitle}>Pinned</h2>
            {sortable(pinned, 8, false)}
          </section>
        )}
        {others.length > 0 && (
          <section>
            {pinned.length > 0 && <h2 className={sectionTitle}>Others</h2>}
            {sortable(others, 8, false)}
          </section>
        )}
        <p className="text-center text-xs text-faint">Press and hold a note to move it.</p>
      </div>
    );

  return (
    // Sideways moves are the page's (swipes), up and down scroll.
    <div className={cn("relative flex [touch-action:pan-y] flex-col", className)} {...swipe}>
      {deeper ? (
        // A level deeper: the way back, and what this is.
        <div className="mb-2 flex min-h-11 items-center gap-1 md:mb-4">
          <Button variant="ghost" size="icon" aria-label="Back to all notes" onClick={back} className="-ml-2">
            <ChevronLeft className="size-6" />
          </Button>
          {collection ? (
            <>
              <h2 className={cn("flex min-w-0 flex-1 items-center gap-2 text-lg font-semibold", TEMPLATE_TONE.text)}>
                <TemplateIcon template={collection.template} className="size-5 shrink-0" />
                <span className="truncate">{collection.template.name}</span>
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setImporting(true)}>
                <ClipboardPaste /> Import
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${collection.template.name}`}
                title="Delete – it goes to the trash"
                onClick={() => {
                  deleteWithUndo(collection.note, collection.template.name);
                  back();
                }}
              >
                <Trash2 />
              </Button>
            </>
          ) : category ? (
            <>
              <h2
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 text-lg font-semibold",
                  PALETTE[categoryColor(category)].ink,
                )}
              >
                <span className="size-2.5 shrink-0 rounded-full bg-current" />
                <span className="truncate">{category.name}</span>
                <span className="text-sm font-medium text-faint tabular-nums">{shown.length}</span>
              </h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${category.name}`}
                title="Rename, recolour or delete"
                onClick={() => setCategorySheet({ mode: "edit", category })}
              >
                <Pencil className="size-4" />
              </Button>
            </>
          ) : null}
        </div>
      ) : (
        <NotesTabs
          vault={view === "vault"}
          vaultOpen={vaultOpen}
          onAll={() => enter("all")}
          onVault={openVault}
          className="mb-2 md:mb-4"
        />
      )}
      {!collection && <Composer onCreate={(draft, pin) => create(draft, pin)} className="max-md:hidden" />}
      {/* Phones: only this part scrolls (room at the end for the + button). */}
      <div className="[touch-action:pan-y] max-md:-mx-4 max-md:min-h-0 max-md:flex-1 max-md:overflow-y-auto max-md:overscroll-contain max-md:px-4 max-md:pb-20">
        <motion.div
          key={viewKey(view)}
          initial={{ opacity: 0, x: slide.direction * 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {inVault && (
            <div
              className={cn(
                "mt-2 flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm md:mt-6",
                VAULT_TONE.soft,
                VAULT_TONE.text,
              )}
            >
              <Lock className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">The vault is open – it locks when you leave it.</span>
              <Button variant="ghost" size="sm" onClick={() => enter("all")}>
                Lock
              </Button>
            </div>
          )}
          {loading ? (
            <div className={cn(grid, "mt-2 md:mt-6")}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-28 rounded-2xl" />
              ))}
            </div>
          ) : collection ? (
            <div className="mt-1 md:mt-2">
              <TemplateView
                template={collection.template}
                note={collection.note}
                onChange={(entries) => saveEntries(collection.note, entries)}
                importing={importing}
                onImportClose={() => setImporting(false)}
              />
            </div>
          ) : view === "all" ? (
            overview()
          ) : (
            list()
          )}
        </motion.div>
      </div>
      {/* A new note right away, like the planner's +: on phones by the thumb (it takes
          less room than a bar, so more notes show), on wide screens in the corner as well
          as "Take a note…" at the top. (A template's collection has its own +.) */}
      {!collection && (
        <Fab
          aria-label={inVault ? "Add a note to the vault" : "Add a note"}
          onClick={() => setEditor({ mode: "create", placement: here })}
          className={cn(
            // Phones: the same spot as the planner's + (1rem inside its card, plus the card's 1px border).
            "max-md:absolute max-md:right-[calc(1rem+1px)] max-md:bottom-[calc(1rem+1px)] md:fixed md:right-[calc(2*var(--gutter))] md:bottom-[calc(2*var(--gutter))]",
            TONE_STYLES.orange.solid,
          )}
        />
      )}
      {editorSheet}
      <CategoriesSheet
        open={managing}
        categories={categoryList}
        onClose={() => setManaging(false)}
        // One sheet at a time: the list closes, the category opens.
        onEdit={(c) => {
          setManaging(false);
          setCategorySheet({ mode: "edit", category: c });
        }}
        onAdd={() => {
          setManaging(false);
          setCategorySheet({ mode: "create" });
        }}
      />
      <CategorySheet
        state={categorySheet}
        onClose={() => setCategorySheet(null)}
        onCreated={(id) => afterSheetClosed(() => enter({ category: id }))}
        onDeleted={(id) => openCategory === id && afterSheetClosed(back)}
        templates={missingTemplates}
        onTemplate={(id) => afterSheetClosed(() => startCollection(id))}
      />
      <VaultPinSheet
        open={pinSheet !== null}
        mode={pinSheet ?? "unlock"}
        unlockAfter
        onClose={() => setPinSheet(null)}
        onDone={() => setViewState("vault")}
      />
    </div>
  );
}

/** In the overview: a category with a peek at its first notes – a tap shows all of it. */
function CategoryTile({
  category,
  notes,
  onOpen,
  onEdit,
}: {
  category: NoteCategory;
  notes: Note[];
  onOpen: () => void;
  onEdit: () => void;
}) {
  // Press and hold (or right-click): rename, recolour, delete – like its chip.
  const longPress = useLongPress(onEdit, 500);
  const style = PALETTE[categoryColor(category)];
  const peek = notes.slice(0, 3);
  return (
    <button
      type="button"
      aria-label={`${category.name}, ${notes.length} ${notes.length === 1 ? "note" : "notes"}`}
      title="Hold to edit"
      {...longPress.props}
      onClick={() => {
        if (!longPress.wasLongPress()) onOpen();
      }}
      className={cn(
        "flex h-full min-h-28 w-full flex-col gap-2 rounded-2xl px-3.5 py-3 text-left transition-[filter] hover:brightness-[1.03] active:brightness-95",
        style.bg,
      )}
    >
      <span className={cn("flex items-center gap-2 font-semibold", style.ink)}>
        <span className="size-2 shrink-0 rounded-full bg-current" />
        <span className="min-w-0 flex-1 truncate">{category.name}</span>
        <span className="text-xs font-medium tabular-nums opacity-80">{notes.length}</span>
      </span>
      {peek.length === 0 ? (
        <span className="text-sm text-faint">Nothing here yet</span>
      ) : (
        <span className="flex flex-col gap-1">
          {peek.map((note) => (
            <span key={note.id} className="flex items-center gap-1.5 text-[0.85rem] leading-snug text-fg/80">
              {note.pinned ? (
                <Pin className="size-3 shrink-0 fill-current text-orange-500 dark:text-orange-300" />
              ) : (
                <span className="size-1 shrink-0 rounded-full bg-current opacity-40" />
              )}
              <span className="min-w-0 truncate">{noteLabel(note)}</span>
            </span>
          ))}
          {notes.length > peek.length && <span className="text-xs text-faint">+{notes.length - peek.length} more</span>}
        </span>
      )}
    </button>
  );
}

/** "Take a note…" – expands to an optional title and the text, like Keep. */
function Composer({ onCreate, className }: { onCreate: (draft: NoteDraft, pin: boolean) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pin, setPin] = useState(false);
  const box = useRef<HTMLFormElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const commit = () => {
    onCreate({ title, body }, pin);
    setTitle("");
    setBody("");
    setPin(false);
    setOpen(false);
  };

  // Clicking/tapping outside saves the note (like Keep).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element;
      if (box.current?.contains(target) || target.closest("[data-osk]")) return;
      commit();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  });

  return (
    <form
      ref={box}
      className={cn("mx-auto w-full max-w-xl rounded-2xl paper", className)}
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
    >
      {open && (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          aria-label="Note title"
          maxLength={200}
          className="w-full bg-transparent px-4 pt-3.5 text-[1.02rem] font-semibold outline-none placeholder:text-faint"
        />
      )}
      <AutoTextarea
        ref={bodyRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Take a note…"
        aria-label="New note"
        maxLength={20000}
        maxRows={14}
        bare
      />
      {open && (
        <div className="flex items-center gap-2 px-2 pb-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={pin ? "Don't pin" : "Pin"}
            aria-pressed={pin}
            onClick={() => setPin((p) => !p)}
          >
            <Pin className={cn(pin && "fill-current text-orange-500")} />
          </Button>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!title.trim() && !body.trim()}
            className={cn("ui-action shadow-none", TONE_STYLES.orange.solid)}
          >
            Add note
          </Button>
        </div>
      )}
    </form>
  );
}

function NoteEditor({
  state,
  categories,
  vaultAvailable,
  onClose,
  onCreate,
  onSave,
  onDelete,
  onTogglePin,
}: {
  state: EditorState;
  categories: NoteCategory[];
  vaultAvailable: boolean;
  onClose: () => void;
  onCreate: (draft: NoteDraft, pin: boolean, placement: Placement) => void;
  onSave: (note: Note, draft: NoteDraft, placement: Placement) => void;
  onDelete: (note: Note) => void;
  onTogglePin: (note: Note) => void;
}) {
  // Keep showing the last note while the sheet animates out; a fresh editor per opening.
  const [shown, setShown] = useState({ state, count: 0 });
  if (state && state !== shown.state) setShown({ state, count: shown.count + 1 });
  return (
    <NoteEditorSheet
      key={shown.count}
      state={shown.state}
      open={state !== null}
      {...{ categories, vaultAvailable, onClose, onCreate, onSave, onDelete, onTogglePin }}
    />
  );
}

/** The note's text to the clipboard (without its title – that's just its name). */
async function copyNote(title: string, body: string) {
  const text = body.trim() || title.trim();
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Note copied");
  } catch {
    toast.error("Couldn't copy the note");
  }
}

function NoteEditorSheet({
  state,
  open,
  categories,
  vaultAvailable,
  onClose,
  onCreate,
  onSave,
  onDelete,
  onTogglePin,
}: {
  state: EditorState;
  open: boolean;
  categories: NoteCategory[];
  vaultAvailable: boolean;
  onClose: () => void;
  onCreate: (draft: NoteDraft, pin: boolean, placement: Placement) => void;
  onSave: (note: Note, draft: NoteDraft, placement: Placement) => void;
  onDelete: (note: Note) => void;
  onTogglePin: (note: Note) => void;
}) {
  const note = state?.mode === "edit" ? state.note : null;
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [placement, setPlacement] = useState<Placement>(
    note
      ? { categoryId: note.category_id ?? null, vault: note.vault ?? false }
      : state?.mode === "create"
        ? state.placement
        : { categoryId: null, vault: false },
  );
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const deleted = useRef(false);

  const draft = (): NoteDraft => ({ title, body });

  // New notes start typing right away – unless a field (the title) was tapped already.
  useEffect(() => {
    if (state?.mode !== "create") return;
    const id = window.setTimeout(() => {
      const body = bodyRef.current;
      const active = document.activeElement;
      const typing =
        active !== body &&
        !!body?.closest("[role='dialog']")?.contains(active) &&
        !!active?.matches("input, textarea, [contenteditable='true']");
      if (body && !typing) body.focus();
    }, 120);
    return () => window.clearTimeout(id);
  }, [state?.mode]);

  // Closing in any way (X, back gesture, swipe, tap outside) saves.
  const close = () => {
    if (!open) return;
    if (!deleted.current) {
      if (note) {
        onSave(note, draft(), placement);
        if (pinned !== note.pinned) onTogglePin(note);
      } else {
        onCreate(draft(), pinned, placement);
      }
    }
    onClose();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && close()}
      title={note ? "Note" : placement.vault ? "New note in the vault" : "New note"}
      className={FIELD_FOCUS.orange}
      size="half"
      footer={
        <>
          <Button
            variant="ghost"
            size="icon"
            aria-label={pinned ? "Unpin note" : "Pin note"}
            aria-pressed={pinned}
            onClick={() => setPinned((p) => !p)}
          >
            <Pin className={cn(pinned && "fill-current text-orange-500 dark:text-orange-300")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Copy note"
            disabled={!title.trim() && !body.trim()}
            onClick={() => void copyNote(title, body)}
          >
            <Copy />
          </Button>
          {note && (
            <Button
              variant="danger"
              size="icon"
              aria-label="Delete note"
              onClick={() => {
                deleted.current = true;
                onDelete(note);
                onClose();
              }}
            >
              <Trash2 />
            </Button>
          )}
          {/* Ready once there is a note (a title alone isn't one). */}
          <Button
            variant="primary"
            className={cn("ui-action ml-auto shadow-none", TONE_STYLES.orange.solid)}
            disabled={!body.trim()}
            onClick={close}
          >
            Done
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <CategoryPicker
          categoryId={placement.categoryId}
          vault={placement.vault}
          categories={categories}
          vaultAvailable={vaultAvailable}
          onChange={setPlacement}
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          aria-label="Title"
          maxLength={200}
          className="w-full bg-transparent py-1 text-[1.2rem] font-semibold outline-none placeholder:text-faint"
        />
        <AutoTextarea
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Note"
          aria-label="Note"
          minRows={6}
          // Grows with the text; the sheet scrolls (one scroll area, the caret stays in view).
          maxRows={Number.POSITIVE_INFINITY}
          maxLength={20000}
          bare
          className="px-0"
        />
      </div>
    </Sheet>
  );
}
