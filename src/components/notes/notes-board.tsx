"use client";

import { Pin, Plus, StickyNote, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardMoreLink } from "@/components/ui/card";
import { AutoTextarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { SortableList } from "@/components/ui/sortable";
import type { Note } from "@/data/core";
import {
  isNoteEmpty,
  type NoteDraft,
  prepareNote,
  useAddNote,
  useNotes,
  useTrashNotes,
  useUpdateNote,
} from "@/data/notes";
import { positionAtStart, positionForMove } from "@/lib/ordering";
import { FIELD_FOCUS, TONE_STYLES } from "@/lib/tones";
import { cn } from "@/lib/utils";

export function noteLabel(note: Pick<Note, "title" | "body">): string {
  const text = note.title?.trim() || note.body.trim().split("\n")[0];
  return text.length > 40 ? `${text.slice(0, 39)}…` : text;
}

/** A note as a card: optional title in bold, then the text. */
function NoteCard({
  note,
  onOpen,
  onTogglePin,
  lines = 8,
  className,
}: {
  note: Note;
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

type EditorState = { mode: "create"; pinned?: boolean } | { mode: "edit"; note: Note } | null;

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
  const add = useAddNote();
  const update = useUpdateNote();
  const trash = useTrashNotes();
  const [editor, setEditor] = useState<EditorState>(null);

  const all = useMemo(() => notes.data ?? [], [notes.data]);
  const pinned = all.filter((n) => n.pinned);
  const others = all.filter((n) => !n.pinned);

  const create = (draft: NoteDraft, pin = false) => {
    if (isNoteEmpty(draft)) return;
    add.mutate(prepareNote({ ...draft, pinned: pin, position: positionAtStart(pin ? pinned : others) }));
  };

  // Deleting moves a note to the trash (see NotesTrashButton); undo brings it right back.
  const deleteWithUndo = (note: Note) => {
    trash.mutate({ ids: [note.id], trash: true });
    toast(`Moved "${noteLabel(note)}" to the trash`, {
      action: { label: "Undo", onClick: () => trash.mutate({ ids: [note.id], trash: false }) },
      duration: 6000,
    });
  };

  const togglePin = (note: Note) => {
    const group = note.pinned ? others : pinned;
    update.mutate({ id: note.id, patch: { pinned: !note.pinned, position: positionAtStart(group) } });
  };

  const save = (note: Note, draft: NoteDraft) => {
    if (isNoteEmpty(draft)) {
      deleteWithUndo(note);
      return;
    }
    const title = draft.title.trim() || null;
    const body = draft.body.replace(/\s+$/, "");
    if (title !== note.title || body !== note.body) update.mutate({ id: note.id, patch: { title, body } });
  };

  const editorSheet = (
    <NoteEditor
      state={editor}
      onClose={() => setEditor(null)}
      onCreate={(draft, pin) => create(draft, pin)}
      onSave={save}
      onDelete={deleteWithUndo}
      onTogglePin={togglePin}
    />
  );

  const loading = notes.isLoading && all.length === 0;

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
            <Button variant="ghost" size="icon-sm" aria-label="New note" onClick={() => setEditor({ mode: "create" })}>
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
              onClick={() => setEditor({ mode: "create" })}
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
                    <NoteCard note={note} lines={3} onOpen={() => setEditor({ mode: "edit", note })} />
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

  const grid = "grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4";
  const sortable = (items: Note[]) => (
    <SortableList
      items={items}
      layout="grid"
      withHandle={false}
      className={grid}
      onMove={(id, index) => update.mutate({ id, patch: { position: positionForMove(items, id, index) } })}
    >
      {(note) => (
        <NoteCard note={note} onOpen={() => setEditor({ mode: "edit", note })} onTogglePin={() => togglePin(note)} />
      )}
    </SortableList>
  );

  return (
    <div className={cn("flex flex-col", className)}>
      <Composer onCreate={create} className="max-md:hidden" />
      {/* Phones: only this part scrolls; "Take a note" stays below it. */}
      <div className="max-md:-mx-4 max-md:min-h-0 max-md:flex-1 max-md:overflow-y-auto max-md:overscroll-contain max-md:px-4 max-md:pb-3">
        {loading ? (
          <div className={cn(grid, "mt-2 md:mt-6")}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-28 rounded-2xl" />
            ))}
          </div>
        ) : all.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted">
            <StickyNote className="size-10 text-faint" />
            <p className="text-sm">No notes yet. Codes, ideas, gift lists – anything goes.</p>
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-6 md:mt-6">
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
      </div>
      {/* Phones: "Take a note" waits at the bottom, where the thumb is. */}
      <div className="rounded-(--radius-bar) p-2 bar md:hidden">
        <button
          type="button"
          onClick={() => setEditor({ mode: "create" })}
          className="flex w-full items-center gap-2 text-left"
        >
          <span className="field flex h-12 flex-1 items-center rounded-2xl px-4 text-[0.95rem] text-faint well">
            Take a note…
          </span>
          {/* Pale like the empty add buttons of shopping and backlog: tapping opens the editor, nothing is added yet. */}
          <span
            aria-hidden="true"
            className={cn(
              "ui-action grid size-12 shrink-0 place-items-center rounded-2xl opacity-45",
              TONE_STYLES.orange.solid,
            )}
          >
            <Plus className="size-5" />
          </span>
        </button>
      </div>
      {editorSheet}
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
  onClose,
  onCreate,
  onSave,
  onDelete,
  onTogglePin,
}: {
  state: EditorState;
  onClose: () => void;
  onCreate: (draft: NoteDraft, pin: boolean) => void;
  onSave: (note: Note, draft: NoteDraft) => void;
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
      {...{ onClose, onCreate, onSave, onDelete, onTogglePin }}
    />
  );
}

function NoteEditorSheet({
  state,
  open,
  onClose,
  onCreate,
  onSave,
  onDelete,
  onTogglePin,
}: {
  state: EditorState;
  open: boolean;
  onClose: () => void;
  onCreate: (draft: NoteDraft, pin: boolean) => void;
  onSave: (note: Note, draft: NoteDraft) => void;
  onDelete: (note: Note) => void;
  onTogglePin: (note: Note) => void;
}) {
  const note = state?.mode === "edit" ? state.note : null;
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [pinned, setPinned] = useState(note?.pinned ?? false);
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
        onSave(note, { title, body });
        if (pinned !== note.pinned) onTogglePin(note);
      } else {
        onCreate({ title, body }, pinned);
      }
    }
    onClose();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && close()}
      title={note ? "Note" : "New note"}
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
          <Button
            variant="primary"
            className={cn("ui-action ml-auto shadow-none", TONE_STYLES.orange.solid)}
            onClick={close}
          >
            Done
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
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
          maxRows={20}
          maxLength={20000}
          bare
          className="px-0"
        />
      </div>
    </Sheet>
  );
}
