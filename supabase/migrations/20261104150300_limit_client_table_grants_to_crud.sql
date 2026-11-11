-- Grant browser clients only the CRUD privileges required by AZ V1.
-- RLS continues to enforce per-user row ownership.
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
