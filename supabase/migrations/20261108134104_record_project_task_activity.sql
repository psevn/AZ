create or replace function private.record_project_task_activity()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.project_activity (project_id, actor_id, event_type, payload)
    values (
      new.project_id,
      auth.uid(),
      'task_created',
      jsonb_build_object('task_id', new.id, 'title', new.title)
    );

    if new.assignee_id is not null then
      insert into public.project_activity (project_id, actor_id, event_type, payload)
      values (
        new.project_id,
        auth.uid(),
        'task_assigned',
        jsonb_build_object('task_id', new.id, 'assignee_id', new.assignee_id)
      );
    end if;

    return new;
  end if;

  if old.assignee_id is distinct from new.assignee_id then
    insert into public.project_activity (project_id, actor_id, event_type, payload)
    values (
      new.project_id,
      auth.uid(),
      case when old.assignee_id is null then 'task_assigned' else 'task_reassigned' end,
      jsonb_build_object(
        'task_id', new.id,
        'previous_assignee_id', old.assignee_id,
        'assignee_id', new.assignee_id
      )
    );
  end if;

  if old.status is distinct from new.status then
    insert into public.project_activity (project_id, actor_id, event_type, payload)
    values (
      new.project_id,
      auth.uid(),
      case when new.status = 'done' then 'task_completed' else 'task_status_changed' end,
      jsonb_build_object(
        'task_id', new.id,
        'title', new.title,
        'previous_status', old.status,
        'status', new.status
      )
    );
  end if;

  return new;
end;
$function$;

revoke all on function private.record_project_task_activity() from public;

create trigger record_project_task_activity_after_change
after insert or update of assignee_id, status on public.project_tasks
for each row
execute function private.record_project_task_activity();
