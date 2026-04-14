-- Add per-project export permission configuration
ALTER TABLE projects
  ADD COLUMN export_allowed_roles text[] NOT NULL DEFAULT ARRAY['admin', 'qa_engineer', 'sdet'];
