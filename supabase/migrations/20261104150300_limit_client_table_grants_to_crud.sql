-- Browser clients need CRUD for user-managed planning and study records only.
-- RLS policies continue to enforce that each row belongs to auth.uid().
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['subjects','tasks','focus_sessions','notes'] LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
  END LOOP;
END
$$;
