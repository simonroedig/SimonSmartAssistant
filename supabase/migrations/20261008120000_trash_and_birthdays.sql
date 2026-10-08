-- =============================================================================
-- Notes trash, birthdays, new shopping items on top
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Deleted notes first go to the trash: restore them or delete them for good.
-- -----------------------------------------------------------------------------
alter table public.notes add column deleted_at timestamptz;

create index notes_trash_idx on public.notes (user_id, deleted_at) where deleted_at is not null;

-- -----------------------------------------------------------------------------
-- Shopping: new items go to the top (like the backlog and notes).
-- -----------------------------------------------------------------------------
alter table public.shopping_items
  alter column position set default -extract(epoch from clock_timestamp());

-- -----------------------------------------------------------------------------
-- birthdays: people and their birthday (the year is optional) for the planner
-- -----------------------------------------------------------------------------
create table public.birthdays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  month smallint not null check (month between 1 and 12),
  day smallint not null check (day between 1 and 31),
  year smallint check (year is null or year between 1900 and 2100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A real calendar date (29 February only without a year or in a leap year).
  constraint birthdays_valid_date check (
    day <= case when month = 2 then 29 when month in (4, 6, 9, 11) then 30 else 31 end
    and not (
      month = 2 and day = 29 and year is not null
      and not (year % 4 = 0 and (year % 100 <> 0 or year % 400 = 0))
    )
  )
);

create index birthdays_user_date_idx on public.birthdays (user_id, month, day);

create trigger birthdays_touch before update on public.birthdays
  for each row execute function private.touch_row();

revoke all on table public.birthdays from anon, authenticated;
grant select, insert, update, delete on table public.birthdays to authenticated;

alter table public.birthdays enable row level security;

create policy birthdays_select_own on public.birthdays
  for select to authenticated using ((select auth.uid()) = user_id);
create policy birthdays_insert_own on public.birthdays
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy birthdays_update_own on public.birthdays
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy birthdays_delete_own on public.birthdays
  for delete to authenticated using ((select auth.uid()) = user_id);

alter publication supabase_realtime add table public.birthdays;
