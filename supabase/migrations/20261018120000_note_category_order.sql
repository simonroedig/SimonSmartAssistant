-- =============================================================================
-- Note categories in an order of the user's choosing (drag and drop)
-- =============================================================================

-- Lower position = further left. New categories go to the end; existing ones keep
-- their current order (oldest first).
alter table public.note_categories
  add column position double precision not null default extract(epoch from clock_timestamp());

update public.note_categories c
set position = o.rn
from (
  select id, row_number() over (partition by user_id order by created_at) as rn
  from public.note_categories
) o
where c.id = o.id;

create index note_categories_position_idx on public.note_categories (user_id, position);
