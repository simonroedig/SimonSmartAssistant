-- =============================================================================
-- One palette for planner blocks and note categories
-- =============================================================================
-- Blocks lose teal (too close to green) and amber becomes a lighter yellow;
-- blue (darker than sky) is new. Note categories now pick from the same
-- colours: their violet was called "accent", their amber goes to orange.

update public.plan_blocks set color = 'emerald' where color = 'teal';
update public.plan_blocks set color = 'yellow' where color = 'amber';

alter table public.note_categories drop constraint note_categories_color_check;
update public.note_categories
set color = case color when 'accent' then 'violet' when 'amber' then 'orange' else color end
where color in ('accent', 'amber');
alter table public.note_categories
  add constraint note_categories_color_check check (
    color in ('violet', 'indigo', 'blue', 'sky', 'emerald', 'lime', 'yellow', 'orange', 'rose', 'pink', 'slate')
  );
