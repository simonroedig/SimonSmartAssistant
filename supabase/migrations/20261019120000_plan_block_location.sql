-- =============================================================================
-- Planner blocks: an optional place (opened in Google Maps from the block)
-- =============================================================================

alter table public.plan_blocks
  add column location text check (location is null or char_length(location) <= 200);
