-- =============================================================================
-- Mind: every reminder card gets a number (1, 2, 3 … in the order they were
-- added) that stays with it – "today it's No. 7". New cards get the next one.
-- =============================================================================

alter table public.mind_items add column number integer check (number is null or number > 0);

-- The cards there are: numbered in the order they came.
update public.mind_items m
set number = n.number
from (
  select id, row_number() over (partition by user_id order by created_at, id) as number
  from public.mind_items
  where kind = 'card'
) n
where m.id = n.id;

-- A new card without a number (a restored backup brings its own): the next one.
-- Runs as the user, so it only sees (and counts) their own cards.
create function private.number_mind_card()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'card' and new.number is null then
    new.number := coalesce(
      (select max(number) from public.mind_items where user_id = new.user_id and kind = 'card'),
      0
    ) + 1;
  end if;
  return new;
end;
$$;

create trigger mind_items_number before insert on public.mind_items
  for each row execute function private.number_mind_card();
