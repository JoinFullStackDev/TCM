-- Drop the "FOR ALL authenticated" policy on user_google_tokens.
-- All token operations (read, upsert, delete) are performed exclusively via
-- the service role in server-side API routes (/lib/google/tokenStore.ts).
-- No client-facing RLS policy is needed; the service role bypasses RLS.
DROP POLICY IF EXISTS "google_tokens_own" ON user_google_tokens;
