create index if not exists documents_subject_user_idx on public.documents (subject_id, user_id);
create index if not exists focus_sessions_task_user_idx on public.focus_sessions (task_id, user_id);
create index if not exists notes_document_user_idx on public.notes (document_id, user_id);
create index if not exists notes_user_id_idx on public.notes (user_id);
create index if not exists quiz_attempts_question_user_idx on public.quiz_attempts (question_id, user_id);
create index if not exists quiz_questions_quiz_user_idx on public.quiz_questions (quiz_id, user_id);
create index if not exists quiz_questions_user_id_idx on public.quiz_questions (user_id);
create index if not exists quizzes_document_user_idx on public.quizzes (document_id, user_id);
create index if not exists quizzes_user_id_idx on public.quizzes (user_id);
create index if not exists subjects_user_id_idx on public.subjects (user_id);
create index if not exists tasks_subject_user_idx on public.tasks (subject_id, user_id);

alter table public.documents
  add constraint documents_storage_path_owner_chk
  check (storage_path like user_id::text || '/%');
