do $$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.academic_terms') is null
     or to_regclass('public.class_meetings') is null
     or to_regclass('public.projects') is null
     or to_regclass('public.project_tasks') is null
     or to_regclass('public.project_documents') is null
     or to_regclass('public.project_activity') is null
     or to_regclass('private.question_keys') is null then
    raise exception 'A required AZ table is missing after clean migration replay';
  end if;

  if to_regprocedure('private.sweep_stuck_reservations(integer)') is null then
    raise exception 'Credit reservation sweep function is missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'completed_at'
  ) then
    raise exception 'tasks.completed_at is missing';
  end if;

  if (select count(*) from cron.job where jobname = 'sweep-stuck-reservations') <> 1 then
    raise exception 'Expected exactly one local cron schedule stub';
  end if;
end
$$;
