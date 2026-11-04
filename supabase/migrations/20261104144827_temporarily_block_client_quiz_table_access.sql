CREATE POLICY "temporary_block_client_quiz_questions" ON public.quiz_questions AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "temporary_block_client_quiz_attempts" ON public.quiz_attempts AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
