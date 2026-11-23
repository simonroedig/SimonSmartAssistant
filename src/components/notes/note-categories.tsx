"use client";

import { Check, Lock, Search, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { newId, type NoteCategory } from "@/data/core";
import { categoryColor, useDeleteCategory, useSaveCategory } from "@/data/note-categories";
import { PALETTE, PALETTE_COLORS, type PaletteColor } from "@/lib/palette";
import { FIELD_FOCUS, TONE_STYLES } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { CHIP, CHIP_IDLE, CHIP_ON } from "@/components/ui/chip";
import { useScrollToPressed } from "@/hooks/use-scroll-to-pressed";

/**
 * What the notes page shows: the overview of everything but the vault ("all"), the
 * vault, or one category (a level deeper, with a way back).
 */
export type NoteFilter = "all" | "vault" | { category: string };

export const VAULT_TONE = TONE_STYLES.slate;

/** A note's category, small and in its colour. */
export function CategoryTag({ category, className }: { category: NoteCategory; className?: string }) {
  const style = PALETTE[categoryColor(category)];
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.72rem] font-medium",
        style.bg,
        style.ink,
        className,
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      <span className="truncate">{category.name}</span>
    </span>
  );
}

/**
 * Above the notes: the vault (it may ask for the PIN first) and All – the overview with
 * the categories – and, on the right, search. Sideways swipes go between the vault and All.
 * Searching, the row is the search field (it searches what's shown: all notes, or the vault).
 */
export function NotesTabs({
  vault,
  vaultOpen,
  onAll,
  onVault,
  query,
  onSearch,
  onQuery,
  onCloseSearch,
  className,
}: {
  /** The vault is shown. */
  vault: boolean;
  vaultOpen: boolean;
  onAll: () => void;
  onVault: () => void;
  /** null: not searching. */
  query: string | null;
  onSearch: () => void;
  onQuery: (query: string) => void;
  onCloseSearch: () => void;
  className?: string;
}) {
  if (query !== null) {
    return (
      <div role="search" className={cn("flex items-center gap-2 py-1", FIELD_FOCUS.quiet, className)}>
        <label className="relative flex min-w-0 flex-1 items-center">
          <Search className="pointer-events-none absolute left-3.5 size-4 text-faint" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && onCloseSearch()}
            // Opened by tapping search: type right away.
            autoFocus
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder={vault ? "Search the vault" : "Search notes"}
            aria-label={vault ? "Search the vault" : "Search notes"}
            // As tall as the chips (nothing moves), in the look of the app's other fields.
            className="field h-9 w-full rounded-full pr-4 pl-10 text-[0.95rem] transition-colors outline-none well placeholder:text-faint focus:border-(--field-focus) focus:bg-surface-hover [&::-webkit-search-cancel-button]:appearance-none"
          />
        </label>
        <button
          type="button"
          aria-label="Close search"
          onClick={onCloseSearch}
          className={cn(CHIP, CHIP_IDLE, "w-9 justify-center px-0")}
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }
  return (
    <div role="group" aria-label="Notes" className={cn("flex items-center gap-2 py-1", className)}>
      <button
        type="button"
        aria-pressed={vault}
        aria-label={vaultOpen ? "Vault (open)" : "Vault"}
        title="Vault"
        onClick={onVault}
        // Open, the vault stands out in solid grey.
        className={cn(CHIP, "gap-1.5", vault ? VAULT_TONE.solid : CHIP_IDLE)}
      >
        <Lock className="size-4" strokeWidth={2.4} />
        Vault
      </button>
      <button
        type="button"
        aria-pressed={!vault}
        onClick={onAll}
        className={cn(CHIP, !vault ? cn("bg-fg/8 text-fg", CHIP_ON) : CHIP_IDLE)}
      >
        All
      </button>
      <button
        type="button"
        aria-label={vault ? "Search the vault" : "Search notes"}
        onClick={onSearch}
        className={cn(CHIP, CHIP_IDLE, "ml-auto")}
      >
        <Search className="size-4" />
        Search
      </button>
    </div>
  );
}

/** In the note editor: which category the note belongs to (or the vault). Tap again for none. */
export function CategoryPicker({
  categoryId,
  vault,
  categories,
  vaultAvailable,
  onChange,
}: {
  categoryId: string | null;
  vault: boolean;
  categories: NoteCategory[];
  /** The vault can be picked (a PIN is set). */
  vaultAvailable: boolean;
  onChange: (value: { categoryId: string | null; vault: boolean }) => void;
}) {
  const row = useScrollToPressed(vault ? "vault" : categoryId);
  if (categories.length === 0 && !vaultAvailable && !vault) return null;
  const small = "h-8 px-3 text-[0.8rem]";
  return (
    <div
      ref={row}
      role="group"
      aria-label="Category"
      data-swipe
      className="-mx-1 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-1 py-0.5"
    >
      {(vaultAvailable || vault) && (
        <button
          type="button"
          aria-pressed={vault}
          onClick={() => onChange({ categoryId: null, vault: !vault })}
          className={cn(CHIP, small, vault ? VAULT_TONE.solid : CHIP_IDLE)}
        >
          <Lock className="size-3" strokeWidth={2.4} />
          Vault
        </button>
      )}
      {categories.map((category) => {
        const style = PALETTE[categoryColor(category)];
        const active = !vault && categoryId === category.id;
        return (
          <button
            key={category.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange({ categoryId: active ? null : category.id, vault: false })}
            className={cn(CHIP, small, active ? cn(style.bg, style.ink, CHIP_ON) : CHIP_IDLE)}
          >
            <span className={cn("size-1.5 rounded-full bg-current", style.ink)} />
            {category.name}
          </button>
        );
      })}
    </div>
  );
}

export type CategorySheetState = { mode: "create" } | { mode: "edit"; category: NoteCategory } | null;

/** New category, or rename / recolour / delete one. */
export function CategorySheet({
  state,
  onClose,
  onCreated,
  onDeleted,
}: {
  state: CategorySheetState;
  onClose: () => void;
  onCreated?: (id: string) => void;
  onDeleted?: (id: string) => void;
}) {
  // A fresh form per opening, kept while it animates out.
  const [shown, setShown] = useState({ state, count: 0 });
  if (state && state !== shown.state) setShown({ state, count: shown.count + 1 });
  return (
    <CategoryForm
      key={shown.count}
      state={shown.state}
      open={state !== null}
      onClose={onClose}
      onCreated={onCreated}
      onDeleted={onDeleted}
    />
  );
}

function CategoryForm({
  state,
  open,
  onClose,
  onCreated,
  onDeleted,
}: {
  state: CategorySheetState;
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
  onDeleted?: (id: string) => void;
}) {
  const editing = state?.mode === "edit" ? state.category : null;
  const [name, setName] = useState(editing?.name ?? "");
  const [color, setColor] = useState<PaletteColor>(editing ? categoryColor(editing) : "sky");
  const save = useSaveCategory();
  const remove = useDeleteCategory();
  const nameRef = useRef<HTMLInputElement>(null);

  // A new one starts typing (once the sheet is in); editing doesn't pop the keyboard up.
  useEffect(() => {
    if (!open || editing) return;
    const id = window.setTimeout(() => nameRef.current?.focus(), 150);
    return () => window.clearTimeout(id);
  }, [open, editing]);

  const submit = () => {
    if (!name.trim()) return;
    const id = editing?.id ?? newId();
    save.mutate({ id, name, color, isNew: !editing });
    if (!editing) onCreated?.(id);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={editing ? "Edit category" : "New category"}
      size="sm"
      className={FIELD_FOCUS.orange}
      footer={
        <>
          {editing && (
            <Button
              variant="danger"
              size="icon"
              aria-label="Delete category"
              title="Delete – its notes stay, without a category"
              onClick={() => {
                remove.mutate({ id: editing.id });
                onDeleted?.(editing.id);
                onClose();
              }}
            >
              <Trash2 />
            </Button>
          )}
          <Button
            variant="primary"
            className={cn("ui-action ml-auto shadow-none", TONE_STYLES.orange.solid)}
            disabled={!name.trim()}
            onClick={submit}
          >
            {editing ? "Save" : "Add category"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name, e.g. Work"
          aria-label="Category name"
          maxLength={30}
          className="field h-11 w-full rounded-2xl px-4 text-[0.95rem] outline-none well placeholder:text-faint focus:border-(--field-focus)"
        />
        <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2.5">
          {PALETTE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={PALETTE[c].label}
              title={PALETTE[c].label}
              onClick={() => setColor(c)}
              className={cn(
                "grid size-9 place-items-center rounded-full transition-transform active:scale-95",
                PALETTE[c].swatch,
                PALETTE[c].onSwatch,
                color === c && "ring-2 ring-fg/70 ring-offset-2 ring-offset-(--surface-strong)",
              )}
            >
              {color === c && <Check className="size-4" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </form>
    </Sheet>
  );
}
