-- planning_items is a read model, not a writable resource.
revoke all on table public.planning_items from authenticated;
grant select on table public.planning_items to authenticated;
