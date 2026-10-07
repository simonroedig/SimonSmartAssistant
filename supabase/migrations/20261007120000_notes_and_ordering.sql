-- =============================================================================
-- Notes, manual ordering for shopping + backlog, one text field per backlog item
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Manual order (drag and drop). Lower position = higher up in the list.
-- Moving an item sets its position between its new neighbours.
-- -----------------------------------------------------------------------------

-- Shopping: new items go to the bottom.
alter table public.shopping_items
  add column position double precision not null default extract(epoch from clock_timestamp());

update public.shopping_items s
set position = o.rn
from (
  select id, row_number() over (partition by user_id order by created_at) as rn
  from public.shopping_items
) o
where s.id = o.id;

create index shopping_items_position_idx on public.shopping_items (user_id, position);

-- Backlog: new items go to the top. Existing items keep their current order
-- (starred first, then by due date, then oldest first).
alter table public.todos
  add column position double precision not null default -extract(epoch from clock_timestamp());

update public.todos t
set position = o.rn
from (
  select id, row_number() over (
    partition by user_id order by starred desc, due_date asc nulls last, created_at asc
  ) as rn
  from public.todos
) o
where t.id = o.id;

create index todos_position_idx on public.todos (user_id, position);

-- -----------------------------------------------------------------------------
-- Backlog items are one free text (like a note): the first line is shown as the
-- headline. Fold existing notes into the text and allow longer texts.
-- -----------------------------------------------------------------------------
alter table public.todos drop constraint if exists todos_title_check;

update public.todos
set title = btrim(title) || E'\n' || btrim(notes),
    notes = null
where notes is not null and btrim(notes) <> '';

alter table public.todos
  add constraint todos_title_check check (char_length(btrim(title)) between 1 and 5000);

-- -----------------------------------------------------------------------------
-- notes: quick notes with an optional title, pinnable and sortable
-- -----------------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text check (title is null or char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 20000),
  pinned boolean not null default false,
  -- New notes go to the top.
  position double precision not null default -extract(epoch from clock_timestamp()),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_not_empty check (char_length(btrim(coalesce(title, ''))) > 0 or char_length(btrim(body)) > 0)
);

create index notes_user_order_idx on public.notes (user_id, pinned desc, position);

create trigger notes_touch before update on public.notes
  for each row execute function private.touch_row();

revoke all on table public.notes from anon, authenticated;
grant select, insert, update, delete on table public.notes to authenticated;

alter table public.notes enable row level security;

create policy notes_select_own on public.notes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy notes_insert_own on public.notes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy notes_update_own on public.notes
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy notes_delete_own on public.notes
  for delete to authenticated using ((select auth.uid()) = user_id);

alter publication supabase_realtime add table public.notes;
