CREATE INDEX IF NOT EXISTS question_keys_question_id_user_id_idx
  ON private.question_keys (question_id, user_id);
