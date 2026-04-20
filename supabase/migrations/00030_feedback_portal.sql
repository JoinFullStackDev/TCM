-- Migration: 00030_feedback_portal.sql
-- External Feedback Portal: new enums, tables, indexes, RLS, storage bucket, integration types

-- ============================================================
-- 1. New Enums
-- ============================================================

CREATE TYPE feedback_submission_type AS ENUM ('bug', 'feature_request');

CREATE TYPE feedback_severity AS ENUM ('critical', 'high', 'medium', 'low');

CREATE TYPE feedback_environment AS ENUM ('production', 'staging', 'development');

CREATE TYPE feedback_status AS ENUM (
  'new',
  'under_review',
  'accepted',
  'rejected',
  'exported'
);

-- ============================================================
-- 2. feedback_submissions table
-- ============================================================

CREATE TABLE feedback_submissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid REFERENCES projects(id) ON DELETE SET NULL,
  submission_type     feedback_submission_type NOT NULL,
  title               text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 500),
  severity            feedback_severity NULL,
  description         text NOT NULL CHECK (char_length(description) >= 10),
  steps_to_reproduce  text NULL,
  expected_behavior   text NULL,
  actual_behavior     text NULL,
  loom_url            text NULL CHECK (loom_url IS NULL OR loom_url ~* '^https?://'),
  submitter_name      text NULL,
  submitter_email     text NULL CHECK (submitter_email IS NULL OR submitter_email ~* '^[^@]+@[^@]+\.[^@]+$'),
  environment         feedback_environment NULL,
  status              feedback_status NOT NULL DEFAULT 'new',
  internal_notes      text NULL,
  exports             jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Honeypot: must be empty; checked server-side, never displayed
  _hp_field           text NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX feedback_submissions_project_id_idx  ON feedback_submissions (project_id);
CREATE INDEX feedback_submissions_status_idx       ON feedback_submissions (status);
CREATE INDEX feedback_submissions_type_idx         ON feedback_submissions (submission_type);
CREATE INDEX feedback_submissions_severity_idx     ON feedback_submissions (severity);
CREATE INDEX feedback_submissions_created_at_idx   ON feedback_submissions (created_at DESC);

-- updated_at trigger — use moddatetime extension if available, else manual trigger
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'moddatetime'
  ) THEN
    EXECUTE $SQL$
      CREATE TRIGGER set_feedback_submissions_updated_at
        BEFORE UPDATE ON feedback_submissions
        FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
    $SQL$;
  ELSE
    EXECUTE $SQL$
      CREATE OR REPLACE FUNCTION _feedback_submissions_set_updated_at()
      RETURNS TRIGGER AS $TRG$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $TRG$ LANGUAGE plpgsql;

      CREATE TRIGGER set_feedback_submissions_updated_at
        BEFORE UPDATE ON feedback_submissions
        FOR EACH ROW EXECUTE FUNCTION _feedback_submissions_set_updated_at();
    $SQL$;
  END IF;
END;
$$;

-- RLS
ALTER TABLE feedback_submissions ENABLE ROW LEVEL SECURITY;

-- Anonymous users may INSERT (public form)
CREATE POLICY feedback_submissions_insert_anon ON feedback_submissions
  FOR INSERT TO anon
  WITH CHECK (true);

-- Authenticated users with qa_engineer+ role may SELECT
CREATE POLICY feedback_submissions_select_auth ON feedback_submissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('qa_engineer', 'sdet', 'admin')
    )
  );

-- Authenticated qa_engineer+ may UPDATE (triage)
CREATE POLICY feedback_submissions_update_auth ON feedback_submissions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('qa_engineer', 'sdet', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('qa_engineer', 'sdet', 'admin')
    )
  );

-- Only admin may hard-delete
CREATE POLICY feedback_submissions_delete_admin ON feedback_submissions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ============================================================
-- 3. feedback_attachments table
-- ============================================================

CREATE TABLE feedback_attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id   uuid NOT NULL REFERENCES feedback_submissions(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  file_name     text NOT NULL,
  file_size     bigint NULL,
  mime_type     text NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX feedback_attachments_feedback_id_idx ON feedback_attachments (feedback_id);

ALTER TABLE feedback_attachments ENABLE ROW LEVEL SECURITY;

-- Anonymous may INSERT (upload during public form submission)
CREATE POLICY feedback_attachments_insert_anon ON feedback_attachments
  FOR INSERT TO anon
  WITH CHECK (true);

-- Authenticated qa_engineer+ may SELECT
CREATE POLICY feedback_attachments_select_auth ON feedback_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('qa_engineer', 'sdet', 'admin')
    )
  );

-- ============================================================
-- 4. New integration types
-- ============================================================

ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'gitlab_issues';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'ado';

-- ============================================================
-- 5. Storage bucket: feedback-attachments
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-attachments',
  'feedback-attachments',
  false,
  10485760,
  ARRAY[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm',
    'application/pdf',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "anon_insert_feedback_attachments"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'feedback-attachments');

CREATE POLICY "auth_select_feedback_attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'feedback-attachments'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('qa_engineer', 'sdet', 'admin')
  )
);

CREATE POLICY "admin_delete_feedback_attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'feedback-attachments'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);
