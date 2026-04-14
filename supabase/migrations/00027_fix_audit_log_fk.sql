-- Fix export_audit_log project_id FK: change ON DELETE RESTRICT to ON DELETE CASCADE
-- so that deleting a project also removes its audit log entries.
ALTER TABLE export_audit_log
  DROP CONSTRAINT export_audit_log_project_id_fkey;

ALTER TABLE export_audit_log
  ADD CONSTRAINT export_audit_log_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
