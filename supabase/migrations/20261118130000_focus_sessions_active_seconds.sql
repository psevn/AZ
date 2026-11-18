-- Preserve real wall-clock timestamps while recording actual focused time.
-- NULL remains valid for historical rows created before this column existed.
alter table public.focus_sessions
  add column active_seconds integer;

alter table public.focus_sessions
  add constraint focus_sessions_active_seconds_nonnegative
  check (active_seconds is null or active_seconds >= 0);

comment on column public.focus_sessions.active_seconds is
  'Actual focused time in seconds, excluding paused intervals. NULL for legacy sessions.';
