"use client";

import { Check, Eraser, Plus, ShoppingBasket, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardMoreLink } from "@/components/ui/card";
import { CheckCircle } from "@/components/ui/check-circle";
import { Input, Label } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { DragHandle, SortableList } from "@/components/ui/sortable";
import { PHONE_ADD_ROW, PHONE_SCROLL_AREA } from "@/components/ui/phone-add-row";
import { SwipeRow } from "@/components/ui/swipe-row";
import type { ShoppingItem } from "@/data/core";
import {
  prepareShoppingItem,
  useAddShoppingItem,
  useDeleteShoppingItems,
  useForgetSuggestion,
  useRestoreShoppingItems,
  useShoppingHistory,
  useShoppingItems,
  useUpdateShoppingItem,
} from "@/data/shopping";
import { useLongPress } from "@/hooks/use-long-press";
import { byPosition, positionAtStart, positionForMove } from "@/lib/ordering";
import { FIELD_FOCUS, TONE_STYLES } from "@/lib/tones";
import { cn, vibrate } from "@/lib/utils";

function ItemRow({
  item,
  onToggle,
  onDelete,
  onEdit,
}: {
  item: ShoppingItem;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const longPress = useLongPress(onEdit);
  return (
    <SwipeRow onDelete={onDelete}>
      <div className="group flex items-center">
        {!item.checked && <DragHandle label={`Move ${item.name}`} className="-mr-2" />}
        <button
          type="button"
          {...longPress.props}
          onClick={() => {
            if (longPress.wasLongPress()) return;
            vibrate(6);
            onToggle();
          }}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-surface-hover"
        >
          <CheckCircle checked={item.checked} tone="emerald" />
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "block truncate text-[0.98rem] transition-colors",
                item.checked && "text-faint line-through decoration-faint/60",
              )}
            >
              {item.name}
            </span>
          </span>
          {item.note && (
            <span
              className={cn(
                "shrink-0 rounded-full bg-surface-hover px-2 py-0.5 text-xs font-medium text-muted",
                item.checked && "opacity-50",
              )}
            >
              {item.note}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${item.name}`}
          className="mr-1 hidden size-10 shrink-0 place-items-center rounded-xl text-faint transition-colors group-hover:grid hover:bg-danger/10 hover:text-danger [@media(pointer:coarse)]:hidden"
        >
          <X className="size-4" />
        </button>
      </div>
    </SwipeRow>
  );
}

export function ShoppingList({
  variant = "page",
  limit,
  className,
}: {
  variant?: "page" | "card";
  /** Home card on phones: only the first items, no inner scrolling – the rest is on the page. */
  limit?: number;
  className?: string;
}) {
  const items = useShoppingItems();
  const history = useShoppingHistory();
  const add = useAddShoppingItem();
  const update = useUpdateShoppingItem();
  const remove = useDeleteShoppingItems();
  const restore = useRestoreShoppingItems();
  const forget = useForgetSuggestion();

  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const all = useMemo(() => items.data ?? [], [items.data]);
  const open = all.filter((i) => !i.checked).sort(byPosition);
  const done = all.filter((i) => i.checked).sort((a, b) => (b.checked_at ?? "").localeCompare(a.checked_at ?? ""));
  const shown = limit ? open.slice(0, limit) : open;
  const more = [
    open.length > shown.length && `${open.length - shown.length} more`,
    limit && done.length > 0 && `${done.length} in the cart`,
  ].filter(Boolean);

  const suggestions = useMemo(() => {
    const onList = new Set(open.map((i) => i.name.trim().toLowerCase()));
    const term = draft.trim().toLowerCase();
    return (history.data ?? [])
      .filter((h) => !onList.has(h.name_key))
      .filter((h) => (term ? h.name_key.includes(term) && h.name_key !== term : true))
      .slice(0, variant === "card" ? 6 : 12);
  }, [history.data, open, draft, variant]);

  const addItem = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = all.find((i) => i.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (existing && !existing.checked) {
      toast(`"${existing.name}" is already on the list`);
      return;
    }
    // New (and re-added) items go to the top of the list.
    if (existing?.checked) {
      update.mutate({ id: existing.id, patch: { checked: false, position: positionAtStart(open) } });
    } else {
      add.mutate(prepareShoppingItem({ name: trimmed, position: positionAtStart(open) }));
    }
  };

  const deleteWithUndo = (toDelete: ShoppingItem[], label: string) => {
    if (toDelete.length === 0) return;
    remove.mutate({ ids: toDelete.map((i) => i.id) });
    toast(label, {
      action: { label: "Undo", onClick: () => restore.mutate({ items: toDelete }) },
      duration: 6000,
    });
  };

  const showSuggestions = suggestions.length > 0 && (variant === "page" || focused || draft.length > 0);

  const onPage = variant === "page";
  const body = (
    <>
      <div className={cn(onPage && PHONE_ADD_ROW, onPage && "max-md:flex max-md:flex-col-reverse")}>
        <form
          className={cn("flex items-center gap-2", FIELD_FOCUS.emerald)}
          onSubmit={(e) => {
            e.preventDefault();
            addItem(draft);
            setDraft("");
          }}
        >
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 150)}
            placeholder="Add an item…"
            aria-label="New shopping item"
            enterKeyHint="done"
            autoComplete="off"
            maxLength={120}
          />
          <Button
            type="submit"
            variant="primary"
            size="icon"
            aria-label="Add item"
            disabled={!draft.trim()}
            // Keep the focus (and the phone's keyboard) in the field: adding needs one tap, and the next item can follow.
            onMouseDown={(e) => e.preventDefault()}
            className={cn(
              "ui-action size-12 shrink-0 shadow-[0_8px_24px_-12px_rgb(16_185_129)]",
              TONE_STYLES.emerald.solid,
            )}
          >
            <Plus className="!size-5" />
          </Button>
        </form>

        <AnimatePresence initial={false}>
          {showSuggestions && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div
                className={cn(
                  "flex flex-wrap gap-1.5 pt-3",
                  // In the phone's bottom bar: one row to swipe through, above the field.
                  onPage &&
                    "max-md:[scrollbar-width:none] max-md:flex-nowrap max-md:overflow-x-auto max-md:px-1 max-md:pt-1 max-md:pb-2.5",
                )}
              >
                <span className="flex shrink-0 items-center gap-1 pr-1 text-xs font-medium text-faint">
                  <Sparkles className="size-3" /> Often
                </span>
                {suggestions.map((s) => (
                  <SuggestionChip
                    key={s.name_key}
                    name={s.name}
                    onAdd={() => {
                      addItem(s.name);
                      setDraft("");
                    }}
                    onForget={() => {
                      forget.mutate({ nameKey: s.name_key });
                      toast(`Removed "${s.name}" from suggestions`);
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={cn("mt-3 flex flex-col", onPage && PHONE_SCROLL_AREA)}>
        {items.isLoading && all.length === 0 ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-12" />
            ))}
          </div>
        ) : open.length === 0 && done.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted">
            <ShoppingBasket className="size-8 text-faint" />
            <p className="text-sm">Nothing to buy. Enjoy the free fridge space.</p>
          </div>
        ) : (
          <SortableList
            items={shown}
            className="flex flex-col"
            onMove={(id, index) => update.mutate({ id, patch: { position: positionForMove(open, id, index) } })}
          >
            {(item) => (
              <ItemRow
                item={item}
                onToggle={() => update.mutate({ id: item.id, patch: { checked: true } })}
                onDelete={() => deleteWithUndo([item], `Deleted "${item.name}"`)}
                onEdit={() => setEditing(item)}
              />
            )}
          </SortableList>
        )}

        {more.length > 0 && (
          <CardMoreLink href="/shopping" tone="emerald">
            {more.join(" · ")}
          </CardMoreLink>
        )}

        {!limit && done.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between px-3 pb-1">
              <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-faint uppercase">
                <Check className="size-3.5" /> In the cart · {done.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteWithUndo(done, `Cleared ${done.length} ${done.length === 1 ? "item" : "items"}`)}
              >
                <Eraser /> Clear
              </Button>
            </div>
            <ul className="flex flex-col">
              <AnimatePresence initial={false}>
                {done.map((item) => (
                  <motion.li
                    key={item.id}
                    layout="position"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <ItemRow
                      item={item}
                      onToggle={() => update.mutate({ id: item.id, patch: { checked: false } })}
                      onDelete={() => deleteWithUndo([item], `Deleted "${item.name}"`)}
                      onEdit={() => setEditing(item)}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        )}
      </div>

      <EditItemSheet
        item={editing}
        onClose={() => setEditing(null)}
        onSave={(patch) => editing && update.mutate({ id: editing.id, patch })}
        onDelete={() => editing && deleteWithUndo([editing], `Deleted "${editing.name}"`)}
      />
    </>
  );

  if (variant === "card") {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader icon={<ShoppingBasket />} title="Shopping" count={open.length} tone="emerald" href="/shopping" />
        <div className={cn("px-4 pb-4", !limit && "min-h-0 flex-1 overflow-y-auto")}>{body}</div>
      </Card>
    );
  }

  return <div className={className}>{body}</div>;
}

function SuggestionChip({ name, onAdd, onForget }: { name: string; onAdd: () => void; onForget: () => void }) {
  const longPress = useLongPress(onForget, 650);
  return (
    <button
      type="button"
      {...longPress.props}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        if (longPress.wasLongPress()) return;
        onAdd();
      }}
      className="flex h-9 shrink-0 items-center gap-1 rounded-full pr-3.5 pl-2.5 text-sm font-medium transition-colors well hover:border-emerald-500/40 hover:bg-emerald-500/10 active:scale-95"
    >
      <Plus className="size-3.5 text-emerald-500" />
      {name}
    </button>
  );
}

function EditItemSheet({
  item,
  onClose,
  onSave,
  onDelete,
}: {
  item: ShoppingItem | null;
  onClose: () => void;
  onSave: (patch: { name: string; note: string | null }) => void;
  onDelete: () => void;
}) {
  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()} title="Edit item" size="sm">
      {item && <EditItemForm key={item.id} item={item} onClose={onClose} onSave={onSave} onDelete={onDelete} />}
    </Sheet>
  );
}

function EditItemForm({
  item,
  onClose,
  onSave,
  onDelete,
}: {
  item: ShoppingItem;
  onClose: () => void;
  onSave: (patch: { name: string; note: string | null }) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [note, setNote] = useState(item.note ?? "");
  return (
    <form
      className={cn("flex flex-col gap-4", FIELD_FOCUS.emerald)}
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({ name: name.trim(), note: note.trim() || null });
        onClose();
      }}
    >
      <div>
        <Label htmlFor="item-name">Item</Label>
        <Input id="item-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      </div>
      <div>
        <Label htmlFor="item-note">Amount or note</Label>
        <Input
          id="item-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. 2x, 500 g, organic"
          maxLength={120}
        />
      </div>
      <div className="mt-2 flex gap-2">
        <Button
          variant="danger"
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          Delete
        </Button>
        <Button
          type="submit"
          variant="primary"
          className={cn("ui-action ml-auto shadow-none", TONE_STYLES.emerald.solid)}
          disabled={!name.trim()}
        >
          Save
        </Button>
      </div>
    </form>
  );
}
