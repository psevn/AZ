create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on function public.handle_new_user() is 'HANDOFF: creates a public.profiles row (language defaults to ar) when a new auth user signs up. Added by Claude (chat session), 2026-11-04.';
comment on table public.documents is 'HANDOFF: user PDFs. storage_path MUST be "{user_id}/{file}.pdf" in storage bucket "documents"; enforced by CHECK documents_storage_path_owner_chk and by storage.objects RLS policies documents_*_own.';
comment on table public.profiles is 'HANDOFF: one row per auth user, auto-created by trigger on_auth_user_created.';
comment on table public.subjects is 'HANDOFF: all user-owned tables have RLS "own rows" policies and composite FKs (id, user_id) so rows cannot link across users. Keep this pattern for new tables.';
