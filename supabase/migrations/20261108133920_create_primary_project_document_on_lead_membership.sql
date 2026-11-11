create or replace function private.create_primary_project_document_for_lead()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.role = 'lead'
     and new.user_id = auth.uid()
     and exists (
       select 1
       from public.projects p
       where p.id = new.project_id
         and p.created_by = new.user_id
     )
  then
    insert into public.project_documents (
      project_id,
      title,
      document_type,
      is_primary,
      created_by
    )
    values (
      new.project_id,
      'Project report',
      'report',
      true,
      new.user_id
    )
    on conflict (project_id) where is_primary do nothing;
  end if;

  return new;
end;
$function$;

revoke all on function private.create_primary_project_document_for_lead() from public;

create trigger create_primary_project_document_after_lead_membership
after insert on public.project_members
for each row
execute function private.create_primary_project_document_for_lead();
