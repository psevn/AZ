-- The unified Planning view contains personal and project-scoped records.
-- Do not expose it to unauthenticated API clients.
revoke all on table public.planning_items from anon;
grant select on table public.planning_items to authenticated;
