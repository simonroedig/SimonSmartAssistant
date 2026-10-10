-- =============================================================================
-- Blocked apps: a self-limit for the Android launcher
-- =============================================================================
-- Apps chosen in Settings → Blocked apps. The app may only add them: there is no
-- update or delete grant for `authenticated`, so a blocked app stays blocked until
-- its row is deleted by hand in the Supabase dashboard (Table Editor or SQL).

create table public.blocked_apps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Android package name, e.g. com.twitter.android
  package text not null check (package ~ '^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)+$' and char_length(package) <= 255),
  -- What the launcher called it, so the row is readable in the dashboard.
  label text not null default '' check (char_length(label) <= 120),
  created_at timestamptz not null default now(),
  constraint blocked_apps_unique unique (user_id, package)
);

revoke all on table public.blocked_apps from anon, authenticated;
grant select, insert on table public.blocked_apps to authenticated;

alter table public.blocked_apps enable row level security;

create policy blocked_apps_select_own on public.blocked_apps
  for select to authenticated using ((select auth.uid()) = user_id);
create policy blocked_apps_insert_own on public.blocked_apps
  for insert to authenticated with check ((select auth.uid()) = user_id);

alter publication supabase_realtime add table public.blocked_apps;
