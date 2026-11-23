-- =============================================================================
-- Mind: what helps in everyday life – reminders as cards (a few lines of text,
-- maybe a title and where it's from) and pinned videos (YouTube, TikTok, …).
-- "Let go" (a note from a template) moves here in the app; its data stays a note.
-- =============================================================================

create table public.mind_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('card', 'video')),
  title text not null default '' check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 4000),
  -- Who said it, or where it's from.
  source text not null default '' check (char_length(source) <= 200),
  -- A video's link: links only (http/https), never anything to run.
  url text check (url is null or (char_length(url) <= 2000 and url ~ '^https?://[^ ]+$')),
  -- A card without text, or a video without a link, is nothing.
  check (
    (kind = 'card' and char_length(btrim(body)) > 0)
    or (kind = 'video' and url is not null)
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mind_items_user_idx on public.mind_items (user_id, created_at desc);

create trigger mind_items_touch before update on public.mind_items
  for each row execute function private.touch_row();

revoke all on table public.mind_items from anon, authenticated;
grant select, insert, update, delete on table public.mind_items to authenticated;

alter table public.mind_items enable row level security;

create policy mind_items_select_own on public.mind_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy mind_items_insert_own on public.mind_items
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy mind_items_update_own on public.mind_items
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy mind_items_delete_own on public.mind_items
  for delete to authenticated using ((select auth.uid()) = user_id);

alter publication supabase_realtime add table public.mind_items;
