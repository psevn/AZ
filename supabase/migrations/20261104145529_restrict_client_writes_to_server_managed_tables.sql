-- Server-generated resources are read-only to authenticated clients.
DROP POLICY IF EXISTS documents_own ON public.documents;
CREATE POLICY documents_read_own
  ON public.documents FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
REVOKE ALL PRIVILEGES ON TABLE public.documents FROM anon, authenticated;
GRANT SELECT ON TABLE public.documents TO authenticated;

DROP POLICY IF EXISTS quizzes_own ON public.quizzes;
CREATE POLICY quizzes_read_own
  ON public.quizzes FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
REVOKE ALL PRIVILEGES ON TABLE public.quizzes FROM anon, authenticated;
GRANT SELECT ON TABLE public.quizzes TO authenticated;

-- Usage records are written by trusted backend code, never by the browser.
REVOKE ALL PRIVILEGES ON TABLE public.ai_usage_log FROM anon, authenticated;
GRANT SELECT ON TABLE public.ai_usage_log TO authenticated;

-- Users may view their profile and edit only display_name/language.
DROP POLICY IF EXISTS profiles_own ON public.profiles;
CREATE POLICY profiles_read_own
  ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));
CREATE POLICY profiles_update_own
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM anon, authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (display_name, language) ON TABLE public.profiles TO authenticated;
