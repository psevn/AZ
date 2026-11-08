-- Publish project changes so members' unified Planning feed can refresh live.
alter publication supabase_realtime add table public.projects, public.project_tasks, public.project_members;
