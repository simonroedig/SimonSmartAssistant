-- =============================================================================
-- Daily briefing: written each morning by a scheduled Claude task (claude.ai →
-- Scheduled) and shown on the dashboard. The task has no sign-in: it only holds a
-- briefing key, which can do exactly two things – read the prompt and hand in a
-- briefing (or say that it failed). Everything else stays signed-in only.
-- =============================================================================

create table public.briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 'error': the run couldn't finish (the reason is in `error`).
  status text not null default 'ok' check (status in ('ok', 'error')),
  -- Markdown, shown as text (never as HTML).
  content text not null default '' check (char_length(content) <= 20000),
  error text check (error is null or char_length(error) <= 500),
  -- The prompt the run was given, for looking it up later.
  prompt text check (prompt is null or char_length(prompt) <= 20000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index briefings_user_idx on public.briefings (user_id, created_at desc);

revoke all on table public.briefings from anon, authenticated;
-- Briefings are only written through briefing_post(); the app reads them, marks them read
-- and may delete them.
grant select, delete on table public.briefings to authenticated;
grant update (read_at) on table public.briefings to authenticated;

alter table public.briefings enable row level security;

create policy briefings_select_own on public.briefings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy briefings_update_own on public.briefings
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy briefings_delete_own on public.briefings
  for delete to authenticated using ((select auth.uid()) = user_id);

alter publication supabase_realtime add table public.briefings;

-- The prompt (edited in Settings) and when the current key was made.
create table public.briefing_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  prompt text not null default $prompt$Du bist mein persönlicher Nachrichten-Redakteur. Heute ist {{WOCHENTAG}}, der {{DATUM}}, {{UHRZEIT}} Uhr. Ich lebe in München.

## Deine Aufgabe
Recherchiere mit der Websuche selbstständig, was gerade in der Welt passiert, und schreib mir ein kompaktes Briefing. Ziel: Ich will im Zahn der Zeit bleiben – also nicht nur Politik, sondern alles, worüber gerade gesprochen wird oder worüber ich Bescheid wissen sollte, um mitreden zu können.

## Wie du recherchierst
1. Verschaff dir zuerst einen breiten Überblick: Top-Nachrichten weltweit, Deutschland, Bayern/München.
2. Prüfe dann gezielt saisonale und wiederkehrende Ereignisse, die um dieses Datum herum typisch sind (z. B. Preisverleihungen, Gipfel, Wahlen, Messen, Sport-Großereignisse, Produktvorstellungen, Gedenktage, Fristen, Zeitumstellung). Überlege aktiv: „Was passiert jedes Jahr um diese Zeit?“ und suche nach dem aktuellen Stand.
3. Suche nach Ereignissen der nächsten 1–3 Wochen, die man leicht verpasst, aber kennen sollte.
4. Recherchiere meine Interessensgebiete (siehe unten).
5. Wenn etwas wichtig klingt, such nach einer zweiten Quelle oder Hintergründen, bevor du es aufnimmst. Erfinde nichts – wenn du dir unsicher bist, lass es weg.

## Meine Interessen (stärker gewichten, aber nicht ausschließlich)
- Tech & KI (neue Modelle, große Releases, Regulierung)
- UX/HCI, Design, Interfaces
- Jobmarkt für Software/UX in Deutschland
- Wissenschaft & Raumfahrt
- Gitarren, Musik-Equipment
- Alles, was in München relevant ist (Verkehr, Streiks, Events)

## Mein Level
Ich bin informiert, aber nicht tief in jedem Thema. Erklär kurz den Kontext, wenn ein Thema ohne Vorwissen schwer verständlich ist (ein Satz reicht). Keine Floskeln, keine Wertungen, neutral bei politischen Themen.

## Format (Markdown, auf Deutsch, jede Rubrik als ## Überschrift)
## 🔥 Heute wichtig
3–6 Punkte. Je 1–3 Sätze: was passiert ist + warum es relevant ist.
## 🔄 Läuft gerade weiter
Laufende Geschichten mit neuer Entwicklung (nur, was neu ist).
## 📅 Demnächst
Termine der nächsten Wochen mit Datum, z. B. „3.11. – US-Midterms“.
## 🎓 Gerade im Gespräch
Kultur, Wissenschaft, Preise, Internet-Themen, Kurioses – Dinge, über die man redet.
## 🎯 Für dich
Treffer aus meinen Interessensgebieten.
## 💡 Wusstest du schon?
Ein interessanter Fakt oder Hintergrund zu einem aktuellen Thema.

## Regeln
- Insgesamt maximal ca. 400–500 Wörter.
- Hinter jeden Punkt die Quelle als Link: [Quelle](https://…)
- Lass eine Rubrik weg, wenn es nichts Relevantes gibt, statt sie aufzufüllen.$prompt$
    check (char_length(prompt) between 1 and 20000),
  key_created_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger briefing_settings_touch before update on public.briefing_settings
  for each row execute function private.touch_row();

revoke all on table public.briefing_settings from anon, authenticated;
grant select on table public.briefing_settings to authenticated;
-- Only the prompt is the app's to write; the key's date comes from briefing_new_key().
grant insert (prompt), update (prompt) on table public.briefing_settings to authenticated;

alter table public.briefing_settings enable row level security;

create policy briefing_settings_select_own on public.briefing_settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy briefing_settings_insert_own on public.briefing_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy briefing_settings_update_own on public.briefing_settings
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter publication supabase_realtime add table public.briefing_settings;

-- The key's hash only – the key itself is shown once, when it is made.
create table private.briefing_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  key_hash bytea not null unique,
  created_at timestamptz not null default now()
);

revoke all on table private.briefing_keys from public, anon, authenticated;
alter table private.briefing_keys enable row level security;

-- Whose key this is: given as an argument, or in the x-briefing-key header (which the
-- scheduled task's environment adds to its requests, so the key never sits in the task).
create or replace function private.briefing_user(key text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select k.user_id
  from private.briefing_keys k
  where k.key_hash = extensions.digest(
    coalesce(
      nullif(key, ''),
      nullif(nullif(current_setting('request.headers', true), '')::json ->> 'x-briefing-key', ''),
      ''
    ),
    'sha256'
  );
$$;

revoke all on function private.briefing_user(text) from public;

-- A new key for the signed-in user (the old one stops working). Shown once.
create or replace function public.briefing_new_key()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_key text;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  new_key := 'brf_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into private.briefing_keys (user_id, key_hash, created_at)
  values (uid, extensions.digest(new_key, 'sha256'), now())
  on conflict (user_id) do update set key_hash = excluded.key_hash, created_at = excluded.created_at;
  insert into public.briefing_settings (user_id, key_created_at)
  values (uid, now())
  on conflict (user_id) do update set key_created_at = excluded.key_created_at;
  return new_key;
end;
$$;

revoke all on function public.briefing_new_key() from public, anon;
grant execute on function public.briefing_new_key() to authenticated;

-- The prompt, for the scheduled task (with the key).
create or replace function public.briefing_prompt(key text default null)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.briefing_user(key);
begin
  if uid is null then
    raise exception 'invalid briefing key' using errcode = '28000';
  end if;
  return (select s.prompt from public.briefing_settings s where s.user_id = uid);
end;
$$;

-- Hands in a briefing – or, with `failed`, that today's couldn't be made.
create or replace function public.briefing_post(
  content text default '',
  prompt text default null,
  failed text default null,
  key text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := private.briefing_user(key);
  new_id uuid;
begin
  if uid is null then
    raise exception 'invalid briefing key' using errcode = '28000';
  end if;
  if failed is null and btrim(coalesce(content, '')) = '' then
    raise exception 'empty briefing' using errcode = '22023';
  end if;
  -- A handful a day is plenty, even with runs started by hand.
  if (
    select count(*) from public.briefings b
    where b.user_id = uid and b.created_at > now() - interval '1 day'
  ) >= 20 then
    raise exception 'too many briefings today' using errcode = '54000';
  end if;
  insert into public.briefings (user_id, status, content, error, prompt)
  values (
    uid,
    case when failed is null then 'ok' else 'error' end,
    left(coalesce(content, ''), 20000),
    left(nullif(btrim(failed), ''), 500),
    left(prompt, 20000)
  )
  returning id into new_id;
  -- Only the last two months are kept.
  delete from public.briefings b where b.user_id = uid and b.created_at < now() - interval '60 days';
  return new_id;
end;
$$;

-- The scheduled task has no sign-in: these two are callable with the publishable key
-- alone, and do nothing without a valid briefing key.
revoke all on function public.briefing_prompt(text) from public;
revoke all on function public.briefing_post(text, text, text, text) from public;
grant execute on function public.briefing_prompt(text) to anon, authenticated;
grant execute on function public.briefing_post(text, text, text, text) to anon, authenticated;
