-- Export jobs table for async export tracking
CREATE TABLE export_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  suite_id        uuid REFERENCES suites(id) ON DELETE SET NULL,
  format          export_format NOT NULL,
  scope           export_scope NOT NULL,
  status          export_job_status NOT NULL DEFAULT 'pending',
  result_url      text,
  file_name       text,
  error_message   text,
  test_case_count integer,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

CREATE INDEX idx_export_jobs_user ON export_jobs(user_id);
CREATE INDEX idx_export_jobs_status ON export_jobs(status);

ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only view their own export jobs; INSERT/UPDATE only via service role
CREATE POLICY "export_jobs_own" ON export_jobs
  FOR SELECT TO authenticated USING (user_id = auth.uid());
