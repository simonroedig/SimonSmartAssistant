-- =============================================================================
-- Planner: all-day entries (shown above the day's timeline, like holidays and
-- birthdays, instead of filling it from waking up to bedtime). They keep the
-- whole day as their time range.
-- =============================================================================

alter table public.plan_blocks
  add column all_day boolean not null default false,
  add constraint plan_blocks_all_day_range check (not all_day or (start_min = 0 and end_min = 1440));
