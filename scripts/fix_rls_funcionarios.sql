-- Fix the RLS Policy to avoid querying the protected auth.users table

DROP POLICY IF EXISTS "funcionarios_select_own" ON funcionarios;

CREATE POLICY "funcionarios_select_own"
  ON funcionarios FOR SELECT
  USING (
    auth.uid() = id
    OR email = current_setting('request.jwt.claims', true)::json->>'email'
  );
