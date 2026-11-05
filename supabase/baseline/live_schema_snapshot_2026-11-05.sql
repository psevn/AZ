-- =====================================================================
-- AZ LIVE SCHEMA SNAPSHOT — captured 2026-11-05 from the live Supabase
-- project "AZ" (ap-south-1) by reading the catalogs (read-only queries).
--
-- READ THIS FIRST
--   * This is NOT the original migration history. The five original
--     foundation migrations (20261104141452 ... 20261104143425) are still
--     missing from the repository and this file must not be presented as
--     their source.
--   * It is a reconstruction of the CURRENT STATE, used (a) to build a
--     throwaway local database for tests and (b) as a reference baseline.
--   * Do NOT apply this file to the live project (it would fail: objects
--     already exist). It is for local test databases only.
--   * Not captured: sequences (none), service_role table privileges
--     (Supabase default), default privileges, extensions, storage internals.
-- =====================================================================
set search_path = public;

create schema if not exists private;

-- ------------------------------------------------------------- tables
create table public.profiles (
  id uuid not null,
  display_name text,
  language text not null default 'ar'::text,
  created_at timestamp with time zone not null default now()
);
create table public.subjects (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  color text,
  created_at timestamp with time zone not null default now()
);
create table public.tasks (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  subject_id uuid,
  title text not null,
  due_at timestamp with time zone,
  priority smallint not null default 2,
  est_minutes integer,
  status text not null default 'todo'::text,
  created_at timestamp with time zone not null default now()
);
create table public.focus_sessions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  task_id uuid,
  started_at timestamp with time zone not null default now(),
  ended_at timestamp with time zone
);
create table public.documents (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  subject_id uuid,
  title text not null,
  storage_path text not null,
  status text not null default 'uploaded'::text,
  created_at timestamp with time zone not null default now()
);
create table public.notes (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  document_id uuid,
  body text not null default ''::text,
  updated_at timestamp with time zone not null default now()
);
create table public.quizzes (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  document_id uuid,
  mode text not null default 'standard'::text,
  created_at timestamp with time zone not null default now()
);
create table public.quiz_questions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  quiz_id uuid not null,
  prompt text not null,
  choices jsonb not null
);
create table public.quiz_attempts (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  question_id uuid not null,
  chosen_index smallint not null,
  is_correct boolean not null,
  created_at timestamp with time zone not null default now()
);
create table public.ai_usage_log (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  feature text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10,6) not null default 0,
  created_at timestamp with time zone not null default now()
);
create table private.question_keys (
  question_id uuid not null,
  user_id uuid not null,
  correct_index smallint not null,
  explanation text
);

-- ------------------------------------------- primary keys / uniques
alter table ai_usage_log add constraint ai_usage_log_pkey PRIMARY KEY (id);
alter table documents add constraint documents_pkey PRIMARY KEY (id);
alter table focus_sessions add constraint focus_sessions_pkey PRIMARY KEY (id);
alter table notes add constraint notes_pkey PRIMARY KEY (id);
alter table private.question_keys add constraint question_keys_pkey PRIMARY KEY (question_id);
alter table profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table quiz_attempts add constraint quiz_attempts_pkey PRIMARY KEY (id);
alter table quiz_questions add constraint quiz_questions_pkey PRIMARY KEY (id);
alter table quizzes add constraint quizzes_pkey PRIMARY KEY (id);
alter table subjects add constraint subjects_pkey PRIMARY KEY (id);
alter table tasks add constraint tasks_pkey PRIMARY KEY (id);
alter table documents add constraint documents_id_user_id_key UNIQUE (id, user_id);
alter table documents add constraint documents_storage_path_key UNIQUE (storage_path);
alter table quiz_questions add constraint quiz_questions_id_user_id_key UNIQUE (id, user_id);
alter table quizzes add constraint quizzes_id_user_id_key UNIQUE (id, user_id);
alter table subjects add constraint subjects_id_user_id_key UNIQUE (id, user_id);
alter table tasks add constraint tasks_id_user_id_key UNIQUE (id, user_id);

-- ------------------------------------------------------------ checks
alter table documents add constraint documents_status_check CHECK ((status = ANY (ARRAY['uploaded'::text, 'processing'::text, 'ready'::text, 'failed'::text])));
alter table documents add constraint documents_storage_path_owner_chk CHECK ((storage_path ~~ ((user_id)::text || '/%'::text)));
alter table focus_sessions add constraint focus_sessions_check CHECK (((ended_at IS NULL) OR (ended_at >= started_at)));
alter table private.question_keys add constraint question_keys_correct_index_check CHECK ((correct_index >= 0));
alter table profiles add constraint profiles_language_check CHECK ((language = ANY (ARRAY['ar'::text, 'en'::text])));
alter table quiz_attempts add constraint quiz_attempts_chosen_index_check CHECK ((chosen_index >= 0));
alter table quizzes add constraint quizzes_mode_check CHECK ((mode = ANY (ARRAY['standard'::text, 'professional'::text])));
alter table subjects add constraint subjects_name_check CHECK (((length(name) >= 1) AND (length(name) <= 120)));
alter table tasks add constraint tasks_est_minutes_check CHECK (((est_minutes IS NULL) OR (est_minutes > 0)));
alter table tasks add constraint tasks_priority_check CHECK (((priority >= 1) AND (priority <= 3)));
alter table tasks add constraint tasks_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'doing'::text, 'done'::text])));
alter table tasks add constraint tasks_title_check CHECK (((length(title) >= 1) AND (length(title) <= 300)));

-- ------------------------------------------------------ foreign keys
alter table ai_usage_log add constraint ai_usage_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table documents add constraint documents_subject_id_user_id_fkey FOREIGN KEY (subject_id, user_id) REFERENCES subjects(id, user_id) ON DELETE SET NULL (subject_id);
alter table documents add constraint documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table focus_sessions add constraint focus_sessions_task_id_user_id_fkey FOREIGN KEY (task_id, user_id) REFERENCES tasks(id, user_id) ON DELETE SET NULL (task_id);
alter table focus_sessions add constraint focus_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table notes add constraint notes_document_id_user_id_fkey FOREIGN KEY (document_id, user_id) REFERENCES documents(id, user_id) ON DELETE CASCADE;
alter table notes add constraint notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table private.question_keys add constraint question_keys_question_owner_fk FOREIGN KEY (question_id, user_id) REFERENCES quiz_questions(id, user_id) ON DELETE CASCADE;
alter table profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table quiz_attempts add constraint quiz_attempts_question_id_user_id_fkey FOREIGN KEY (question_id, user_id) REFERENCES quiz_questions(id, user_id) ON DELETE CASCADE;
alter table quiz_attempts add constraint quiz_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table quiz_questions add constraint quiz_questions_quiz_id_user_id_fkey FOREIGN KEY (quiz_id, user_id) REFERENCES quizzes(id, user_id) ON DELETE CASCADE;
alter table quiz_questions add constraint quiz_questions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table quizzes add constraint quizzes_document_id_user_id_fkey FOREIGN KEY (document_id, user_id) REFERENCES documents(id, user_id) ON DELETE CASCADE;
alter table quizzes add constraint quizzes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table subjects add constraint subjects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table tasks add constraint tasks_subject_id_user_id_fkey FOREIGN KEY (subject_id, user_id) REFERENCES subjects(id, user_id) ON DELETE SET NULL (subject_id);
alter table tasks add constraint tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ------------------------------------------------------------ indexes
CREATE INDEX ai_usage_log_user_id_created_at_idx ON public.ai_usage_log USING btree (user_id, created_at DESC);
CREATE INDEX documents_subject_user_idx ON public.documents USING btree (subject_id, user_id);
CREATE INDEX documents_user_id_created_at_idx ON public.documents USING btree (user_id, created_at DESC);
CREATE INDEX focus_sessions_task_user_idx ON public.focus_sessions USING btree (task_id, user_id);
CREATE INDEX focus_sessions_user_id_started_at_idx ON public.focus_sessions USING btree (user_id, started_at DESC);
CREATE INDEX notes_document_user_idx ON public.notes USING btree (document_id, user_id);
CREATE INDEX notes_user_id_idx ON public.notes USING btree (user_id);
CREATE INDEX question_keys_question_id_user_id_idx ON private.question_keys USING btree (question_id, user_id);
CREATE INDEX quiz_attempts_question_user_idx ON public.quiz_attempts USING btree (question_id, user_id);
CREATE INDEX quiz_attempts_user_id_created_at_idx ON public.quiz_attempts USING btree (user_id, created_at DESC);
CREATE INDEX quiz_questions_quiz_id_idx ON public.quiz_questions USING btree (quiz_id);
CREATE INDEX quiz_questions_quiz_user_idx ON public.quiz_questions USING btree (quiz_id, user_id);
CREATE INDEX quiz_questions_user_id_idx ON public.quiz_questions USING btree (user_id);
CREATE INDEX quizzes_document_user_idx ON public.quizzes USING btree (document_id, user_id);
CREATE INDEX quizzes_user_id_idx ON public.quizzes USING btree (user_id);
CREATE INDEX subjects_user_id_idx ON public.subjects USING btree (user_id);
CREATE INDEX tasks_subject_user_idx ON public.tasks USING btree (subject_id, user_id);
CREATE INDEX tasks_user_id_status_due_at_idx ON public.tasks USING btree (user_id, status, due_at);

-- ------------------------------------------ functions and trigger
CREATE OR REPLACE FUNCTION private.submit_answer(p_question_id uuid, p_chosen_index smallint)
 RETURNS TABLE(attempt_id uuid, is_correct boolean, correct_index smallint, explanation text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_choice_count integer;
  v_correct_index smallint;
  v_explanation text;
  v_is_correct boolean;
  v_attempt_id uuid;
  v_created_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_question_id IS NULL OR p_chosen_index IS NULL OR p_chosen_index < 0 THEN
    RAISE EXCEPTION 'Invalid answer input' USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_array_length(q.choices), k.correct_index, k.explanation
    INTO v_choice_count, v_correct_index, v_explanation
  FROM public.quiz_questions AS q
  JOIN private.question_keys AS k
    ON k.question_id = q.id AND k.user_id = q.user_id
  WHERE q.id = p_question_id AND q.user_id = v_user_id
  FOR SHARE OF q;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_chosen_index >= v_choice_count OR v_correct_index >= v_choice_count THEN
    RAISE EXCEPTION 'Answer index out of range' USING ERRCODE = '22023';
  END IF;

  v_is_correct := (p_chosen_index = v_correct_index);

  INSERT INTO public.quiz_attempts (user_id, question_id, chosen_index, is_correct)
  VALUES (v_user_id, p_question_id, p_chosen_index, v_is_correct)
  RETURNING id, created_at INTO v_attempt_id, v_created_at;

  RETURN QUERY SELECT v_attempt_id, v_is_correct, v_correct_index, v_explanation, v_created_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_answer(p_question_id uuid, p_chosen_index smallint)
 RETURNS TABLE(attempt_id uuid, is_correct boolean, correct_index smallint, explanation text, created_at timestamp with time zone)
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  SELECT * FROM private.submit_answer(p_question_id, p_chosen_index);
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$function$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ------------------------------------------------------------- RLS on
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.tasks enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.documents enable row level security;
alter table public.notes enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.ai_usage_log enable row level security;
alter table private.question_keys enable row level security;

-- ----------------------------------------------------------- policies
create policy ai_usage_read_own on public.ai_usage_log for select to authenticated using (user_id = (select auth.uid()));
create policy documents_read_own on public.documents for select to authenticated using (user_id = (select auth.uid()));
create policy focus_sessions_own on public.focus_sessions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notes_own on public.notes for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy profiles_read_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy quiz_attempts_read_own on public.quiz_attempts for select to authenticated using (user_id = (select auth.uid()));
create policy quiz_questions_read_own on public.quiz_questions for select to authenticated using (user_id = (select auth.uid()));
create policy quizzes_read_own on public.quizzes for select to authenticated using (user_id = (select auth.uid()));
create policy subjects_own on public.subjects for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy tasks_own on public.tasks for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- private.question_keys: RLS on, zero policies (default deny) — by design.

create policy documents_delete_own on storage.objects for delete to authenticated using ((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text));
create policy documents_insert_own on storage.objects for insert to authenticated with check ((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text));
create policy documents_select_own on storage.objects for select to authenticated using ((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text));
create policy documents_update_own on storage.objects for update to authenticated using ((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)) with check ((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text));

-- ------------------------------------------------------------- grants
-- Net effective state observed on the live project.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;
grant usage on schema private to authenticated, service_role;

grant select on public.ai_usage_log, public.documents, public.profiles,
  public.quiz_attempts, public.quiz_questions, public.quizzes to authenticated;
grant select, insert, update, delete on public.focus_sessions, public.notes,
  public.subjects, public.tasks to authenticated;
grant update (display_name, language) on public.profiles to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;
revoke execute on function public.submit_answer(uuid, smallint) from public, anon;
grant execute on function public.submit_answer(uuid, smallint) to authenticated, service_role;
revoke execute on function private.submit_answer(uuid, smallint) from public, anon, service_role;
grant execute on function private.submit_answer(uuid, smallint) to authenticated;

-- ------------------------------------------------------ storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 52428800, array['application/pdf']);
