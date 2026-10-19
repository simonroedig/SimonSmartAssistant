"use client";

import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { Copy, Lock, Pin, Plus, StickyNote, Trash2 } from "lucide-react";
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
import { useNoteCategories } from "@/data/note-categories";
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
import { useSwipe } from "@/hooks/use-swipe";
import { positionAtStart, positionForMove } from "@/lib/ordering";
import { FIELD_FOCUS, TOAST_TONE, TONE_STYLES } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { lockVault, useVaultOpen } from "@/lib/vault";
import {
  CategoryPicker,
  CategoriesSheet,
  CategorySheet,
  type CategorySheetState,
  CategoryTag,
  type NoteFilter,
  NoteFilters,
  VAULT_TONE,
} from "./note-categories";
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
  lines?: 3 | 8;
  className?: string;
}) {
  return (
    <div className={cn("group relative rounded-2xl paper transition-colors hover:border-line-strong", className)}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open note "${noteLabel(note)}"`}
        className="block w-full px-4 py-3 pr-10 text-left"
      >
        {note.title && <span className="mb-1 block text-[0.98rem] leading-snug font-semibold">{note.title}</span>}
        {note.body && (
          <span
            className={cn(
              "block text-[0.92rem] leading-snug break-words whitespace-pre-line text-muted",
              lines === 3 ? "line-clamp-3" : "line-clamp-8",
              !note.title && "text-fg",
            )}
          >
            {note.body}
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

const filterKey = (filter: NoteFilter) => (typeof filter === "object" ? filter.category : filter);

/** Notes in a Google Keep-like board (page) or as a scrollable list (home card). */
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
  // Every visit starts with all notes.
  const [filter, setFilter] = useState<NoteFilter>("all");
  const [categorySheet, setCategorySheet] = useState<CategorySheetState>(null);
  const [managing, setManaging] = useState(false);
  const [pinSheet, setPinSheet] = useState<VaultPinMode | null>(null);

  const inVault = variant === "page" && filter === "vault";
  if (filter === "vault" && !vaultOpen) setFilter("all"); // Locked meanwhile (idle, another tab…).
  useVaultGuard();

  const categoryList = useMemo(() => categories.data ?? [], [categories.data]);
  const byId = useMemo(() => new Map(categoryList.map((c) => [c.id, c])), [categoryList]);
  const board = useMemo(() => notes.data ?? [], [notes.data]);
  const vaultList = useMemo(() => (vaultOpen ? (vaultNotes.data ?? []) : []), [vaultOpen, vaultNotes.data]);
  const filteredCategory = typeof filter === "object" ? filter.category : null;
  // A category deleted meanwhile (on another device) shows everything again – not one just being added.
  const savingCategory = useIsMutating({ mutationKey: ["note_categories"] }) > 0;
  if (filteredCategory && categories.data && !savingCategory && !byId.has(filteredCategory)) setFilter("all");

  const all = useMemo(() => {
    if (variant === "card") return board;
    if (filter === "vault") return vaultList;
    if (filteredCategory) return board.filter((n) => n.category_id === filteredCategory);
    if (filter === "none") return board.filter((n) => !n.category_id);
    return board;
  }, [variant, filter, filteredCategory, board, vaultList]);
  const pinned = all.filter((n) => n.pinned);
  const others = all.filter((n) => !n.pinned);

  // New notes land where the page is: in the vault, or in the category it shows.
  const here: Placement = { categoryId: filteredCategory, vault: filter === "vault" };

  /** The list a note belongs to (positions are counted there). */
  const listOf = (vault: boolean) => (vault ? vaultList : board);

  const create = (draft: NoteDraft, pin = false, placement: Placement = here) => {
    if (isNoteEmpty(draft)) return;
    const group = listOf(placement.vault).filter((n) => n.pinned === pin);
    add.mutate(prepareNote({ ...draft, ...placement, pinned: pin, position: positionAtStart(group) }));
    if (placement.vault && !vaultOpen) toast("Added to the vault", { icon: <Lock className="size-4" /> });
  };

  // Deleting moves a note to the trash (see NotesTrashButton); undo brings it right back.
  const deleteWithUndo = (note: Note) => {
    trash.mutate({ ids: [note.id], trash: true });
    toast(`Moved "${noteLabel(note)}" to the trash`, {
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

  const openVault = () => {
    if (filter === "vault") setFilter("all");
    else if (vaultOpen) setFilter("vault");
    else setPinSheet(vaultStatus.data?.hasPin === false ? "setup" : "unlock");
  };

  // Leaving the vault locks it.
  const changeFilter = (next: NoteFilter) => {
    if (filter === "vault" && next !== "vault") lockVault();
    setFilter(next);
  };

  // In the order of the chips: the vault, Others, All, the categories.
  const order = ["vault", "none", "all", ...categoryList.map((c) => c.id)];
  const key = filterKey(filter);

  // The notes slide in from the side the picked filter is on.
  const [shownKey, setShownKey] = useState({ key, direction: 1 });
  if (shownKey.key !== key) {
    setShownKey({ key, direction: order.indexOf(key) < order.indexOf(shownKey.key) ? -1 : 1 });
  }

  // Phones: swipe sideways through the filters, in the order of the chips. The
  // vault is the first (it asks for the PIN when locked); there's no wrapping round.
  const phone = useMediaQuery("(max-width: 767px)");
  const swipe = useSwipe(
    (direction) => {
      const next = order[order.indexOf(key) + direction];
      if (!next) return;
      if (next === "vault") openVault();
      else changeFilter(next === "all" || next === "none" ? next : { category: next });
    },
    variant === "page" && phone && editor === null && categorySheet === null && pinSheet === null && !managing,
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

  const loading = (inVault ? vaultNotes.isLoading : notes.isLoading) && all.length === 0;
  const tagFor = (note: Note) => (note.category_id ? byId.get(note.category_id) : undefined);

  if (variant === "card") {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader
          icon={<StickyNote />}
          title="Notes"
          tone="orange"
          count={all.length}
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
          ) : all.length === 0 ? (
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
                {(limit ? all.slice(0, limit) : all).map((note) => (
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
              {limit && all.length > limit && (
                <CardMoreLink href="/notes" tone="orange">
                  {all.length - limit} more
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
  const sortable = (items: Note[]) => (
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
          category={tagFor(note)}
          onOpen={() => setEditor({ mode: "edit", note })}
          onTogglePin={() => togglePin(note)}
        />
      )}
    </SortableList>
  );

  const emptyText =
    filter === "vault"
      ? "Nothing in the vault yet. Notes here only open with your PIN."
      : filteredCategory
        ? `No notes in ${byId.get(filteredCategory)?.name ?? "this category"} yet.`
        : filter === "none"
          ? "No notes without a category."
          : "No notes yet. Codes, ideas, gift lists – anything goes.";

  return (
    // Sideways moves are the page's (swipes), up and down scroll.
    <div className={cn("relative flex [touch-action:pan-y] flex-col", className)} {...swipe}>
      <NoteFilters
        filter={filter}
        categories={categoryList}
        vaultOpen={vaultOpen}
        onChange={changeFilter}
        onVault={openVault}
        onAdd={() => setCategorySheet({ mode: "create" })}
        onEdit={(category) => setCategorySheet({ mode: "edit", category })}
        onManage={() => setManaging(true)}
        className="mb-2 md:mb-4"
      />
      <Composer onCreate={(draft, pin) => create(draft, pin)} className="max-md:hidden" />
      {/* Phones: only this part scrolls (room at the end for the + button). */}
      <div className="[touch-action:pan-y] max-md:-mx-4 max-md:min-h-0 max-md:flex-1 max-md:overflow-y-auto max-md:overscroll-contain max-md:px-4 max-md:pb-20">
        <motion.div
          key={key}
          initial={{ opacity: 0, x: shownKey.direction * 28 }}
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
              <Button variant="ghost" size="sm" onClick={() => changeFilter("all")}>
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
          ) : all.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-muted">
              {inVault ? <Lock className="size-10 text-faint" /> : <StickyNote className="size-10 text-faint" />}
              <p className="text-sm">{emptyText}</p>
            </div>
          ) : (
            <div className={cn("flex flex-col gap-6", inVault ? "mt-4" : "mt-2 md:mt-6")}>
              {pinned.length > 0 && (
                <section>
                  <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-faint uppercase">Pinned</h2>
                  {sortable(pinned)}
                </section>
              )}
              {others.length > 0 && (
                <section>
                  {pinned.length > 0 && (
                    <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-faint uppercase">Others</h2>
                  )}
                  {sortable(others)}
                </section>
              )}
              <p className="text-center text-xs text-faint">Press and hold a note to move it.</p>
            </div>
          )}
        </motion.div>
      </div>
      {/* A new note right away, like the planner's +: on phones by the thumb (it takes
          less room than a bar, so more notes show), on wide screens in the corner as well
          as "Take a note…" at the top. */}
      <Fab
        aria-label={inVault ? "Add a note to the vault" : "Add a note"}
        onClick={() => setEditor({ mode: "create", placement: here })}
        className={cn(
          // Phones: the same spot as the planner's + (1rem inside its card, plus the card's 1px border).
          "max-md:absolute max-md:right-[calc(1rem+1px)] max-md:bottom-[calc(1rem+1px)] md:fixed md:right-[calc(2*var(--gutter))] md:bottom-[calc(2*var(--gutter))]",
          TONE_STYLES.orange.solid,
        )}
      />
      {editorSheet}
      <CategoriesSheet
        open={managing}
        categories={categoryList}
        onClose={() => setManaging(false)}
        // One sheet at a time: the list closes, the category opens.
        onEdit={(category) => {
          setManaging(false);
          setCategorySheet({ mode: "edit", category });
        }}
        onAdd={() => {
          setManaging(false);
          setCategorySheet({ mode: "create" });
        }}
      />
      <CategorySheet
        state={categorySheet}
        onClose={() => setCategorySheet(null)}
        onCreated={(id) => setFilter({ category: id })}
        onDeleted={(id) => filteredCategory === id && setFilter("all")}
      />
      <VaultPinSheet
        open={pinSheet !== null}
        mode={pinSheet ?? "unlock"}
        unlockAfter
        onClose={() => setPinSheet(null)}
        onDone={() => setFilter("vault")}
      />
    </div>
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

  // New notes start typing right away.
  useEffect(() => {
    if (state?.mode !== "create") return;
    const id = window.setTimeout(() => bodyRef.current?.focus(), 120);
    return () => window.clearTimeout(id);
  }, [state?.mode]);

  // Closing in any way (X, back gesture, swipe, tap outside) saves.
  const close = () => {
    if (!open) return;
    if (!deleted.current) {
      if (note) {
        onSave(note, { title, body }, placement);
        if (pinned !== note.pinned) onTogglePin(note);
      } else {
        onCreate({ title, body }, pinned, placement);
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
