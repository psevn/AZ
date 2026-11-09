-- HANDOFF ONLY — do not run as part of the application build.
-- Apply manually after reviewing. This links a task only to a document owned by
-- the same user. Deleting a document clears document_id and preserves the task.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS document_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_document_id_user_id_fkey'
      AND conrelid = 'public.tasks'::regclass
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_document_id_user_id_fkey
      FOREIGN KEY (document_id, user_id)
      REFERENCES public.documents (id, user_id)
      ON DELETE SET NULL (document_id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS tasks_document_idx
  ON public.tasks (document_id)
  WHERE document_id IS NOT NULL;
