-- Planning UI needs a completion timestamp (done-today ring, Done tab grouped by day, per-subject progress).
alter table public.tasks add column if not exists completed_at timestamptz;

-- Server decides the timestamp: set on the transition to 'done', cleared when un-done. Clients cannot forge it.
create or replace function public.tasks_set_completed_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'done' then
    if tg_op = 'INSERT' or old.status is distinct from 'done' then
      new.completed_at := now();
    else
      new.completed_at := old.completed_at;
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end $$;

drop trigger if exists tasks_set_completed_at on public.tasks;
create trigger tasks_set_completed_at before insert or update on public.tasks
  for each row execute function public.tasks_set_completed_at();

create index if not exists tasks_user_completed_idx on public.tasks (user_id, completed_at desc) where completed_at is not null;

-- Existing done rows (none expected) get a sane value.
update public.tasks set completed_at = created_at where status = 'done' and completed_at is null;

notify pgrst, 'reload schema';
