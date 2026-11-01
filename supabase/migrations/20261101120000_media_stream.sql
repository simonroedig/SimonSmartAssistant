-- =============================================================================
-- Live is split into TV (channels, always on air) and streams (a creator's
-- channel on YouTube, TikTok … that is only live now and then).
-- =============================================================================

alter table public.media_titles drop constraint media_titles_kind_check;
alter table public.media_titles
  add constraint media_titles_kind_check check (kind in ('series', 'movie', 'channel', 'stream', 'link'));
