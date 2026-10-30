-- =============================================================================
-- My Media: the series and films I watch online – where to watch them (my own
-- links) and how far I am – plus live TV channels and handy links (e.g. lists of
-- streaming sites). Episode lists and summaries come from TVmaze in the browser;
-- only titles, links and progress are stored here.
-- =============================================================================

create table public.media_titles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('series', 'movie', 'channel', 'link')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  year smallint check (year between 1870 and 2200),
  -- The show on TVmaze (series): its seasons, episodes and their summaries.
  tvmaze_id integer check (tvmaze_id > 0),
  poster_url text check (poster_url is null or (char_length(poster_url) <= 500 and poster_url ~ '^https://')),
  summary text check (summary is null or char_length(summary) <= 4000),
  -- Where to watch: [{ "label": "Stream", "url": "https://…/season/{season}/episode/{episode}" }];
  -- the first one is used. Links only (http/https), never anything to run.
  sources jsonb not null default '[]'::jsonb check (
    jsonb_typeof(sources) = 'array'
    and jsonb_array_length(sources) <= 10
    and pg_column_size(sources) <= 8000
    and not jsonb_path_exists(sources, '$[*] ? (!(@.url like_regex "^https?://[^ ]+$"))')
  ),
  -- Seen episodes of a series as "season:episode"; a film is seen with `watched`.
  watched_episodes text[] not null default '{}' check (cardinality(watched_episodes) <= 5000),
  watched boolean not null default false,
  last_watched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index media_titles_user_idx on public.media_titles (user_id, last_watched_at desc nulls last);

create trigger media_titles_touch before update on public.media_titles
  for each row execute function private.touch_row();

revoke all on table public.media_titles from anon, authenticated;
grant select, insert, update, delete on table public.media_titles to authenticated;

alter table public.media_titles enable row level security;

create policy media_titles_select_own on public.media_titles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy media_titles_insert_own on public.media_titles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy media_titles_update_own on public.media_titles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy media_titles_delete_own on public.media_titles
  for delete to authenticated using ((select auth.uid()) = user_id);

alter publication supabase_realtime add table public.media_titles;
