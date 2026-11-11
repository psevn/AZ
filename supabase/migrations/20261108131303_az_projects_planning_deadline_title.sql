create or replace view public.planning_items
with (security_invoker = true)
as
  select
    t.id,
    'personal_task'::text as item_type,
    t.title,
    t.due_at,
    t.status,
    t.priority,
    t.est_minutes,
    t.subject_id,
    null::uuid as project_id,
    null::text as project_title
  from public.tasks t
  where t.user_id = (select auth.uid())

  union all

  select
    pt.id,
    'project_task'::text as item_type,
    pt.title,
    pt.due_at,
    pt.status,
    pt.priority,
    pt.est_minutes,
    null::uuid as subject_id,
    p.id as project_id,
    p.title as project_title
  from public.project_tasks pt
  join public.projects p on p.id = pt.project_id
  where pt.assignee_id = (select auth.uid())

  union all

  select
    p.id,
    'project_deadline'::text as item_type,
    p.title as title,
    p.due_at,
    case when p.status = 'completed' then 'done' else 'todo' end as status,
    1::smallint as priority,
    null::integer as est_minutes,
    null::uuid as subject_id,
    p.id as project_id,
    p.title as project_title
  from public.projects p
  where p.due_at is not null
    and private.is_project_member(p.id)
    and p.status <> 'archived';

grant select on public.planning_items to authenticated;
