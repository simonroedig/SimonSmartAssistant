-- =============================================================================
-- Notes: categories, and the vault (notes behind a 4-digit PIN)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- note_categories: the user's own categories (a name and a colour)
-- -----------------------------------------------------------------------------
create table public.note_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  color text not null default 'sky'
    check (color in ('sky', 'emerald', 'yellow', 'amber', 'orange', 'rose', 'accent', 'slate')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Lets notes point to a category of the same user only (see notes_category_fk).
  constraint note_categories_id_user unique (id, user_id)
);

create index note_categories_user_idx on public.note_categories (user_id, created_at);

create trigger note_categories_touch before update on public.note_categories
  for each row execute function private.touch_row();

revoke all on table public.note_categories from anon, authenticated;
grant select, insert, update, delete on table public.note_categories to authenticated;

alter table public.note_categories enable row level security;

create policy note_categories_select_own on public.note_categories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy note_categories_insert_own on public.note_categories
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy note_categories_update_own on public.note_categories
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy note_categories_delete_own on public.note_categories
  for delete to authenticated using ((select auth.uid()) = user_id);

alter publication supabase_realtime add table public.note_categories;

-- -----------------------------------------------------------------------------
-- notes: an optional category, and whether the note is in the vault
-- -----------------------------------------------------------------------------
alter table public.notes
  add column category_id uuid,
  add column vault boolean not null default false,
  -- A note can only point to a category of the same user; deleting the category keeps the note.
  add constraint notes_category_fk foreign key (category_id, user_id)
    references public.note_categories (id, user_id) on delete set null (category_id);

create index notes_category_idx on public.notes (category_id) where category_id is not null;

-- -----------------------------------------------------------------------------
-- The vault: a 4-digit PIN (only its hash is stored) and short-lived unlocks.
-- Vault notes are only readable or changeable with the token of an unlock,
-- sent by the app as the `x-vault-token` header. Wrong PINs are counted and
-- lock the vault for a while (30 s, doubling, at most an hour).
-- -----------------------------------------------------------------------------
create table private.vault_pins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pin_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table private.vault_sessions (
  token_hash bytea primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null
);

create index vault_sessions_user_idx on private.vault_sessions (user_id, expires_at);

-- Only the functions below (security definer) touch these tables.
revoke all on table private.vault_pins, private.vault_sessions from public, anon, authenticated;
alter table private.vault_pins enable row level security;
alter table private.vault_sessions enable row level security;

-- Whether this request carries a valid unlock for the vault (used by the notes policies).
create or replace function private.vault_open()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.vault_sessions s
    where s.user_id = (select auth.uid())
      and s.expires_at > now()
      and s.token_hash = extensions.digest(
        coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-vault-token', ''),
        'sha256'
      )
  );
$$;

revoke all on function private.vault_open() from public;
grant usage on schema private to authenticated;
grant execute on function private.vault_open() to authenticated;

-- Counts a wrong PIN and locks for a while after five in a row.
create or replace function private.vault_wrong_pin(uid uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempts integer;
  until timestamptz;
begin
  update private.vault_pins
  set failed_attempts = failed_attempts + 1
  where user_id = uid
  returning failed_attempts into attempts;
  if attempts >= 5 then
    until := now() + least(interval '1 hour', interval '30 seconds' * power(2, attempts - 5));
    update private.vault_pins set locked_until = until where user_id = uid;
  end if;
  return until;
end;
$$;

revoke all on function private.vault_wrong_pin(uuid) from public;

-- Whether a PIN is set, and until when it is locked after wrong tries.
create or replace function public.vault_status()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'has_pin', p.user_id is not null,
    'locked_until', case when p.locked_until > now() then p.locked_until end
  )
  from (select 1) one
  left join private.vault_pins p on p.user_id = (select auth.uid());
$$;

-- Opens the vault: with the right PIN, a token for 30 minutes.
create or replace function public.vault_unlock(pin text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  rec private.vault_pins;
  token text;
  expires timestamptz := now() + interval '30 minutes';
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select * into rec from private.vault_pins where user_id = uid for update;
  if not found then
    return json_build_object('ok', false, 'reason', 'no_pin');
  end if;
  if rec.locked_until > now() then
    return json_build_object('ok', false, 'reason', 'locked', 'locked_until', rec.locked_until);
  end if;
  if pin is null or pin !~ '^[0-9]{4}$' or extensions.crypt(pin, rec.pin_hash) <> rec.pin_hash then
    return json_build_object('ok', false, 'reason', 'wrong', 'locked_until', private.vault_wrong_pin(uid));
  end if;

  update private.vault_pins set failed_attempts = 0, locked_until = null where user_id = uid;
  delete from private.vault_sessions where user_id = uid and expires_at <= now();
  token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.vault_sessions (token_hash, user_id, expires_at)
  values (extensions.digest(token, 'sha256'), uid, expires);
  return json_build_object('ok', true, 'token', token, 'expires_at', expires);
end;
$$;

-- Sets the PIN. Changing it needs the current PIN – or a sign-in in the last
-- 10 minutes (e.g. with a code from the e-mail), for a forgotten PIN.
create or replace function public.vault_set_pin(new_pin text, current_pin text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  rec private.vault_pins;
  fresh_sign_in boolean;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if new_pin is null or new_pin !~ '^[0-9]{4}$' then
    return json_build_object('ok', false, 'reason', 'invalid');
  end if;

  select * into rec from private.vault_pins where user_id = uid for update;
  if found then
    select exists (
      select 1
      from jsonb_array_elements(coalesce((select auth.jwt()) -> 'amr', '[]'::jsonb)) a
      where (a ->> 'timestamp')::bigint > extract(epoch from now() - interval '10 minutes')
    ) into fresh_sign_in;

    if current_pin is not null then
      if rec.locked_until > now() then
        return json_build_object('ok', false, 'reason', 'locked', 'locked_until', rec.locked_until);
      end if;
      if extensions.crypt(current_pin, rec.pin_hash) <> rec.pin_hash then
        return json_build_object('ok', false, 'reason', 'wrong', 'locked_until', private.vault_wrong_pin(uid));
      end if;
    elsif not fresh_sign_in then
      return json_build_object('ok', false, 'reason', 'sign_in_again');
    end if;

    update private.vault_pins
    set pin_hash = extensions.crypt(new_pin, extensions.gen_salt('bf', 8)),
        failed_attempts = 0,
        locked_until = null,
        updated_at = now()
    where user_id = uid;
    -- A new PIN locks the vault everywhere.
    delete from private.vault_sessions where user_id = uid;
  else
    insert into private.vault_pins (user_id, pin_hash)
    values (uid, extensions.crypt(new_pin, extensions.gen_salt('bf', 8)));
  end if;
  return json_build_object('ok', true);
end;
$$;

revoke all on function public.vault_status() from public, anon;
revoke all on function public.vault_unlock(text) from public, anon;
revoke all on function public.vault_set_pin(text, text) from public, anon;
grant execute on function public.vault_status() to authenticated;
grant execute on function public.vault_unlock(text) to authenticated;
grant execute on function public.vault_set_pin(text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Notes policies: vault notes only with an open vault
-- -----------------------------------------------------------------------------
drop policy notes_select_own on public.notes;
drop policy notes_update_own on public.notes;
drop policy notes_delete_own on public.notes;

create policy notes_select_own on public.notes
  for select to authenticated
  using ((select auth.uid()) = user_id and (not vault or (select private.vault_open())));
-- Moving a note into the vault is fine without opening it; changing a vault note needs it open.
create policy notes_update_own on public.notes
  for update to authenticated
  using ((select auth.uid()) = user_id and (not vault or (select private.vault_open())))
  with check ((select auth.uid()) = user_id);
create policy notes_delete_own on public.notes
  for delete to authenticated
  using ((select auth.uid()) = user_id and (not vault or (select private.vault_open())));
