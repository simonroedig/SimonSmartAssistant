-- My Media: a title's own colour, taken from its poster (or 'none' when the poster
-- has no clear colour), so each series and film is shown in its colours.
alter table public.media_titles
  add column color text check (color is null or color ~ '^(#[0-9a-f]{6}|none)$');
