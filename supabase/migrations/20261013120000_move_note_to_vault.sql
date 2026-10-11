-- =============================================================================
-- Moving a note into the vault while it is locked
-- =============================================================================
-- An update must leave a row the user can still see, and a vault note can't be
-- seen while the vault is locked – so a plain update into the vault is refused.
-- This moves one of the user's own notes in (it can't take anything out).

create or replace function public.move_note_to_vault(note_id uuid, new_position double precision default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  update public.notes
  set vault = true,
      category_id = null,
      position = coalesce(new_position, position)
  where id = note_id and user_id = (select auth.uid()) and not vault;
  return found;
end;
$$;

revoke all on function public.move_note_to_vault(uuid, double precision) from public, anon;
grant execute on function public.move_note_to_vault(uuid, double precision) to authenticated;
