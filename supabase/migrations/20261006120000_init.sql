-- =============================================================================
-- SimonSmartAssistant – initial schema
--
-- Security model (defense in depth):
--   1. Every table lives in `public` but is only reachable through the Data API
--      for the `authenticated` role, via explicit GRANTs (anon gets nothing).
--   2. Row Level Security on every table: a user can only ever see and change
--      rows where user_id = auth.uid().
--   3. A `before-user-created` auth hook rejects every sign-up whose e-mail is
--      not on the allowlist in `private.allowed_emails` (fail closed).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Private schema (never exposed through the Data API)
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;

-- Keeps updated_at fresh and maintains checked_at / done_at timestamps.
create or replace function private.touch_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();

  if tg_table_name = 'shopping_items' then
    if new.checked and (tg_op = 'INSERT' or not old.checked) then
      new.checked_at := now();
    elsif not new.checked then
      new.checked_at := null;
    end if;
  elsif tg_table_name = 'todos' then
    if new.done and (tg_op = 'INSERT' or not old.done) then
      new.done_at := now();
    elsif not new.done then
      new.done_at := null;
    end if;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- user_settings: one row per user (location, sleep schedule, preferences)
-- -----------------------------------------------------------------------------
create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- {"name","region","country","latitude","longitude","timezone"}
  location jsonb check (location is null or jsonb_typeof(location) = 'object'),
  -- 7 entries, Monday first: [{"wake": 420, "bed": 1410}, ...] (minutes after midnight,
  -- bed may exceed 1440 when going to bed after midnight)
  sleep_schedule jsonb not null default '[
    {"wake": 420, "bed": 1410},
    {"wake": 420, "bed": 1410},
    {"wake": 420, "bed": 1410},
    {"wake": 420, "bed": 1410},
    {"wake": 420, "bed": 1470},
    {"wake": 540, "bed": 1470},
    {"wake": 540, "bed": 1410}
  ]'::jsonb check (jsonb_typeof(sleep_schedule) = 'array' and jsonb_array_length(sleep_schedule) = 7),
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- shopping_items + shopping_history (suggestions)
-- -----------------------------------------------------------------------------
create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  note text check (note is null or char_length(note) <= 120),
  checked boolean not null default false,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shopping_items_user_idx on public.shopping_items (user_id, checked, created_at);

create table public.shopping_history (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name_key text not null check (char_length(name_key) between 1 and 120),
  name text not null check (char_length(name) between 1 and 120),
  use_count integer not null default 1 check (use_count > 0),
  last_used_at timestamptz not null default now(),
  primary key (user_id, name_key)
);

create index shopping_history_rank_idx on public.shopping_history (user_id, use_count desc, last_used_at desc);

-- Remember every added item so the UI can offer one-tap suggestions.
-- Runs with the caller's privileges, so RLS on shopping_history applies.
create or replace function private.remember_shopping_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Restored rows ("Undo") keep their original created_at; don't count them twice.
  if new.created_at < now() - interval '30 seconds' then
    return new;
  end if;

  insert into public.shopping_history as h (user_id, name_key, name)
  values (new.user_id, lower(btrim(new.name)), btrim(new.name))
  on conflict (user_id, name_key) do update
    set use_count = h.use_count + 1,
        name = excluded.name,
        last_used_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- todos (backlog)
-- -----------------------------------------------------------------------------
create table public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  notes text check (notes is null or char_length(notes) <= 4000),
  starred boolean not null default false,
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index todos_user_idx on public.todos (user_id, done, created_at);

-- -----------------------------------------------------------------------------
-- plan_blocks (daily planner) + day_notes (focus of the day)
-- -----------------------------------------------------------------------------
create table public.plan_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  start_min smallint not null,
  end_min smallint not null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  notes text check (notes is null or char_length(notes) <= 4000),
  color text not null default 'violet' check (char_length(color) between 1 and 24),
  icon text check (icon is null or char_length(icon) <= 32),
  done boolean not null default false,
  todo_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_blocks_time_range check (
    start_min >= 0 and start_min < 1440 and end_min > start_min and end_min <= 1440
  ),
  -- A block can only point to a todo of the same user.
  constraint plan_blocks_todo_fk foreign key (todo_id, user_id)
    references public.todos (id, user_id) on delete set null (todo_id)
);

create index plan_blocks_user_day_idx on public.plan_blocks (user_id, day, start_min);
create index plan_blocks_todo_idx on public.plan_blocks (todo_id) where todo_id is not null;

create table public.day_notes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  focus text not null default '' check (char_length(focus) <= 200),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create trigger user_settings_touch before update on public.user_settings
  for each row execute function private.touch_row();
create trigger shopping_items_touch before insert or update on public.shopping_items
  for each row execute function private.touch_row();
create trigger shopping_items_remember after insert on public.shopping_items
  for each row execute function private.remember_shopping_item();
create trigger todos_touch before insert or update on public.todos
  for each row execute function private.touch_row();
create trigger plan_blocks_touch before update on public.plan_blocks
  for each row execute function private.touch_row();
create trigger day_notes_touch before update on public.day_notes
  for each row execute function private.touch_row();

-- -----------------------------------------------------------------------------
-- Privileges: nothing for anon, CRUD for authenticated (RLS still applies)
-- -----------------------------------------------------------------------------
revoke all on table
  public.user_settings,
  public.shopping_items,
  public.shopping_history,
  public.todos,
  public.plan_blocks,
  public.day_notes
from anon, authenticated;

grant select, insert, update, delete on table
  public.user_settings,
  public.shopping_items,
  public.shopping_history,
  public.todos,
  public.plan_blocks,
  public.day_notes
to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security: every row belongs to exactly one user
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'user_settings', 'shopping_items', 'shopping_history', 'todos', 'plan_blocks', 'day_notes'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      t || '_select_own', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      t || '_insert_own', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t || '_update_own', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      t || '_delete_own', t
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Realtime: stream changes so every open screen stays in sync
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

alter publication supabase_realtime add table
  public.user_settings,
  public.shopping_items,
  public.todos,
  public.plan_blocks,
  public.day_notes;

-- -----------------------------------------------------------------------------
-- Sign-up allowlist + "Before User Created" auth hook
--
-- After deploying, add your e-mail(s) once in the SQL editor:
--   insert into private.allowed_emails (email) values ('you@example.com');
-- and enable the hook under Authentication → Hooks → "Before User Created"
-- (Postgres function public.hook_before_user_created).
-- -----------------------------------------------------------------------------
create table private.allowed_emails (
  email text primary key check (email = lower(btrim(email)) and email like '%_@_%'),
  note text,
  created_at timestamptz not null default now()
);

alter table private.allowed_emails enable row level security;

grant usage on schema private to supabase_auth_admin;
grant select on table private.allowed_emails to supabase_auth_admin;

create policy allowed_emails_auth_admin_read on private.allowed_emails
  for select to supabase_auth_admin using (true);

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  candidate text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if candidate <> '' and exists (
    select 1 from private.allowed_emails a where a.email = candidate
  ) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'This dashboard is private. Sign-ups are disabled.'
    )
  );
end;
$$;

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

-- -----------------------------------------------------------------------------
-- Keep-alive: a no-op the daily Vercel cron can call so the free project is
-- never paused for inactivity. Returns nothing sensitive.
-- -----------------------------------------------------------------------------
create or replace function public.keepalive()
returns boolean
language sql
stable
set search_path = ''
as $$
  select true;
$$;

revoke execute on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
