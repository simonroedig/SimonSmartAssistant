-- =============================================================================
-- Notes from a template: a note that holds a list of entries with fixed fields
-- (the first template, "letgo", walks a situation that keeps replaying through
-- four questions, then checks it off). The note's body keeps a plain-text copy of
-- the entries, so previews, copying and the trash work as for any note.
-- =============================================================================

alter table public.notes
  add column template text check (template is null or template in ('letgo')),
  add column entries jsonb check (
    entries is null or (jsonb_typeof(entries) = 'array' and octet_length(entries::text) <= 200000)
  );

-- =============================================================================
-- Daily briefing: two weeks are kept (the sheet shows no more than that).
-- =============================================================================

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
  -- Only the last two weeks are kept.
  delete from public.briefings b where b.user_id = uid and b.created_at < now() - interval '14 days';
  return new_id;
end;
$$;

revoke all on function public.briefing_post(text, text, text, text) from public;
grant execute on function public.briefing_post(text, text, text, text) to anon, authenticated;

delete from public.briefings where created_at < now() - interval '14 days';
