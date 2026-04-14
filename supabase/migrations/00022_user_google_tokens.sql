-- Google OAuth token storage for export feature
CREATE TABLE user_google_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Tokens are AES-256 encrypted at the application level before storage
  access_token  text NOT NULL,
  refresh_token text NOT NULL,
  token_expiry  timestamptz NOT NULL,
  scopes        text[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_google_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "google_tokens_own" ON user_google_tokens
  FOR ALL TO authenticated USING (user_id = auth.uid());
