-- Export audit log for compliance tracking
CREATE TABLE export_audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  suite_id        uuid REFERENCES suites(id) ON DELETE SET NULL,
  format          export_format NOT NULL,
  scope           export_scope NOT NULL,
  status          text NOT NULL CHECK (status IN ('success', 'failed')),
  test_case_count integer,
  file_name       text,
  sheets_url      text,
  error_message   text,
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_export_audit_project ON export_audit_log(project_id);
CREATE INDEX idx_export_audit_user ON export_audit_log(user_id);
CREATE INDEX idx_export_audit_created ON export_audit_log(created_at);

ALTER TABLE export_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit log; writes are service-role only
CREATE POLICY "export_audit_admin_select" ON export_audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
