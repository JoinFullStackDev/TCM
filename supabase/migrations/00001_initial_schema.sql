-- =============================================================================
-- TCM Initial Schema Migration
-- Full database schema for MVP (N1–N8) with forward-compatible placeholders (S1–S7)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM (
  'admin',
  'qa_engineer',
  'sdet',
  'viewer'
);

CREATE TYPE test_case_type AS ENUM (
  'functional',
  'performance'
);

CREATE TYPE test_case_category AS ENUM (
  'smoke', 'regression', 'integration', 'e2e', 'unit',
  'acceptance', 'exploratory', 'performance', 'security', 'usability'
);

CREATE TYPE automation_status AS ENUM (
  'not_automated',
  'scripted',
  'in_cicd',
  'out_of_sync'
);

CREATE TYPE execution_status AS ENUM (
  'not_run',
  'pass',
  'fail',
  'blocked',
  'skip'
);

CREATE TYPE platform AS ENUM (
  'desktop',
  'tablet',
  'mobile'
);

CREATE TYPE invitation_status AS ENUM (
  'pending',
  'accepted',
  'expired',
  'revoked'
);

CREATE TYPE test_run_status AS ENUM (
  'planned',
  'in_progress',
  'completed',
  'aborted'
);

CREATE TYPE webhook_event_status AS ENUM (
  'pending',
  'processing',
  'success',
  'failed'
);

CREATE TYPE import_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed'
);

-- ---------------------------------------------------------------------------
-- Utility functions
-- ---------------------------------------------------------------------------

-- Auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- MVP Tables
-- ---------------------------------------------------------------------------

-- profiles ---------------------------------------------------------------
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text UNIQUE NOT NULL,
  full_name   text,
  avatar_url  text,
  role        user_role NOT NULL DEFAULT 'viewer',
  is_active   boolean NOT NULL DEFAULT true,
  last_active_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- invitations ------------------------------------------------------------
CREATE TABLE invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  role        user_role NOT NULL,
  invited_by  uuid NOT NULL REFERENCES profiles(id),
  token       text UNIQUE NOT NULL,
  status      invitation_status NOT NULL DEFAULT 'pending',
  accepted_at timestamptz,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_status ON invitations(status);

-- projects ---------------------------------------------------------------
CREATE TABLE projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  is_archived boolean NOT NULL DEFAULT false,
  created_by  uuid NOT NULL REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_archived ON projects(is_archived);

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- suites -----------------------------------------------------------------
CREATE TABLE suites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name          text NOT NULL,
  prefix        text NOT NULL,
  description   text,
  color_index   smallint NOT NULL DEFAULT 0,
  position      integer NOT NULL DEFAULT 0,
  next_sequence integer NOT NULL DEFAULT 1,
  tags          text[] NOT NULL DEFAULT '{}',
  "group"       text,
  created_by    uuid NOT NULL REFERENCES profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, prefix)
);

CREATE INDEX idx_suites_project ON suites(project_id);
CREATE INDEX idx_suites_position ON suites(project_id, position);
CREATE INDEX idx_suites_tags ON suites USING GIN (tags);
CREATE INDEX idx_suites_group ON suites("group");

CREATE TRIGGER trg_suites_updated_at
  BEFORE UPDATE ON suites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- test_cases -------------------------------------------------------------
CREATE TABLE test_cases (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id            uuid NOT NULL REFERENCES suites(id) ON DELETE CASCADE,
  display_id          text UNIQUE NOT NULL,
  sequence_number     integer NOT NULL,
  title               text NOT NULL,
  description         text,
  precondition        text,
  type                test_case_type NOT NULL DEFAULT 'functional',
  automation_status   automation_status NOT NULL DEFAULT 'not_automated',
  automation_file_path text,
  platform_tags       platform[] NOT NULL DEFAULT '{}',
  priority            text CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  tags                text[] NOT NULL DEFAULT '{}',
  position            integer NOT NULL DEFAULT 0,
  metadata            jsonb NOT NULL DEFAULT '{}',
  category            test_case_category,
  created_by          uuid NOT NULL REFERENCES profiles(id),
  updated_by          uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_test_cases_suite ON test_cases(suite_id);
CREATE INDEX idx_test_cases_display_id ON test_cases(display_id);
CREATE INDEX idx_test_cases_automation_status ON test_cases(automation_status);
CREATE INDEX idx_test_cases_position ON test_cases(suite_id, position);
CREATE INDEX idx_test_cases_category ON test_cases(category);
CREATE INDEX idx_test_cases_tags ON test_cases USING GIN(tags);
CREATE INDEX idx_test_cases_metadata ON test_cases USING GIN(metadata);

CREATE TRIGGER trg_test_cases_updated_at
  BEFORE UPDATE ON test_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- test_steps -------------------------------------------------------------
CREATE TABLE test_steps (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id      uuid NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  step_number       integer NOT NULL,
  description       text NOT NULL,
  test_data         text,
  expected_result   text,
  is_automation_only boolean NOT NULL DEFAULT false,
  category          test_case_category,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(test_case_id, step_number)
);

CREATE INDEX idx_test_steps_case ON test_steps(test_case_id);
CREATE INDEX idx_test_steps_description ON test_steps USING GIN(description gin_trgm_ops);

CREATE TRIGGER trg_test_steps_updated_at
  BEFORE UPDATE ON test_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- test_runs --------------------------------------------------------------
CREATE TABLE test_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  suite_id      uuid REFERENCES suites(id) ON DELETE SET NULL,
  name          text NOT NULL,
  description   text,
  target_version text,
  environment   text,
  status        test_run_status NOT NULL DEFAULT 'planned',
  start_date    timestamptz,
  due_date      timestamptz,
  completed_at  timestamptz,
  is_automated  boolean NOT NULL DEFAULT false,
  source        text NOT NULL DEFAULT 'manual',
  assignee_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by    uuid NOT NULL REFERENCES profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_test_runs_project ON test_runs(project_id);
CREATE INDEX idx_test_runs_suite ON test_runs(suite_id);
CREATE INDEX idx_test_runs_status ON test_runs(status);
CREATE INDEX idx_test_runs_assignee ON test_runs(assignee_id);

CREATE TRIGGER trg_test_runs_updated_at
  BEFORE UPDATE ON test_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- test_run_cases ---------------------------------------------------------
CREATE TABLE test_run_cases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id     uuid NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  test_case_id    uuid NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  overall_status  execution_status NOT NULL DEFAULT 'not_run',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(test_run_id, test_case_id)
);

CREATE INDEX idx_trc_run ON test_run_cases(test_run_id);
CREATE INDEX idx_trc_case ON test_run_cases(test_case_id);

-- execution_results ------------------------------------------------------
CREATE TABLE execution_results (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id   uuid NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  test_case_id  uuid NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  test_step_id  uuid NOT NULL REFERENCES test_steps(id) ON DELETE CASCADE,
  platform      platform NOT NULL,
  browser       text NOT NULL DEFAULT 'default',
  status        execution_status NOT NULL DEFAULT 'not_run',
  executed_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  executed_at   timestamptz,
  duration_ms   integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(test_run_id, test_step_id, platform, browser)
);

CREATE INDEX idx_er_run ON execution_results(test_run_id);
CREATE INDEX idx_er_case ON execution_results(test_case_id);
CREATE INDEX idx_er_step ON execution_results(test_step_id);
CREATE INDEX idx_er_status ON execution_results(status);
CREATE INDEX idx_er_platform ON execution_results(platform);
CREATE INDEX idx_er_composite ON execution_results(test_run_id, test_case_id, platform);

CREATE TRIGGER trg_execution_results_updated_at
  BEFORE UPDATE ON execution_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- annotations ------------------------------------------------------------
CREATE TABLE annotations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_result_id   uuid NOT NULL REFERENCES execution_results(id) ON DELETE CASCADE,
  comment               text,
  created_by            uuid NOT NULL REFERENCES profiles(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_annotations_result ON annotations(execution_result_id);

CREATE TRIGGER trg_annotations_updated_at
  BEFORE UPDATE ON annotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- attachments ------------------------------------------------------------
CREATE TABLE attachments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_id   uuid NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
  storage_path    text NOT NULL,
  file_name       text NOT NULL,
  file_size       bigint,
  mime_type       text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_attachments_annotation ON attachments(annotation_id);

-- test_case_versions -----------------------------------------------------
CREATE TABLE test_case_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id    uuid NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  version_number  integer NOT NULL,
  snapshot        jsonb NOT NULL,
  changed_by      uuid NOT NULL REFERENCES profiles(id),
  change_summary  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(test_case_id, version_number)
);

CREATE INDEX idx_tcv_case ON test_case_versions(test_case_id);
CREATE INDEX idx_tcv_case_version ON test_case_versions(test_case_id, version_number DESC);

-- bug_links --------------------------------------------------------------
CREATE TABLE bug_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id    uuid NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  url             text NOT NULL,
  title           text,
  external_id     text,
  external_status text,
  provider        text NOT NULL DEFAULT 'manual',
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bug_links_case ON bug_links(test_case_id);
CREATE INDEX idx_bug_links_external ON bug_links(provider, external_id);

CREATE TRIGGER trg_bug_links_updated_at
  BEFORE UPDATE ON bug_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- csv_imports ------------------------------------------------------------
CREATE TABLE csv_imports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  suite_id        uuid REFERENCES suites(id) ON DELETE SET NULL,
  file_name       text NOT NULL,
  file_size       bigint,
  column_mappings jsonb,
  total_rows      integer,
  imported_count  integer NOT NULL DEFAULT 0,
  skipped_count   integer NOT NULL DEFAULT 0,
  error_count     integer NOT NULL DEFAULT 0,
  status          import_status NOT NULL DEFAULT 'pending',
  imported_by     uuid NOT NULL REFERENCES profiles(id),
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_csv_imports_project ON csv_imports(project_id);
CREATE INDEX idx_csv_imports_status ON csv_imports(status);

-- csv_import_errors ------------------------------------------------------
CREATE TABLE csv_import_errors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id     uuid NOT NULL REFERENCES csv_imports(id) ON DELETE CASCADE,
  row_number    integer,
  column_name   text,
  error_message text NOT NULL,
  raw_data      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cie_import ON csv_import_errors(import_id);

-- webhook_events ---------------------------------------------------------
CREATE TABLE webhook_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  test_run_id   uuid REFERENCES test_runs(id) ON DELETE SET NULL,
  provider      text NOT NULL DEFAULT 'playwright',
  event_type    text NOT NULL,
  payload       jsonb NOT NULL,
  status        webhook_event_status NOT NULL DEFAULT 'pending',
  error_message text,
  processed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_we_project ON webhook_events(project_id);
CREATE INDEX idx_we_status ON webhook_events(status);
CREATE INDEX idx_we_provider ON webhook_events(provider);

-- grid_column_preferences ------------------------------------------------
CREATE TABLE grid_column_preferences (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  suite_id      uuid REFERENCES suites(id) ON DELETE CASCADE,
  column_config jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id, suite_id)
);

CREATE TRIGGER trg_grid_column_preferences_updated_at
  BEFORE UPDATE ON grid_column_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- Future Placeholder Tables (ship empty, avoid migration pain later)
-- ---------------------------------------------------------------------------

-- integrations (S4 Slack, S5 GitLab) ------------------------------------
CREATE TABLE integrations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  suite_id    uuid REFERENCES suites(id) ON DELETE SET NULL,
  type        text NOT NULL,
  config      jsonb NOT NULL DEFAULT '{}',
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid NOT NULL REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- comments (S7 Collaboration) -------------------------------------------
CREATE TABLE comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   uuid REFERENCES comments(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id   uuid NOT NULL,
  body        text NOT NULL,
  created_by  uuid NOT NULL REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- activity_log (S7 Collaboration) ---------------------------------------
CREATE TABLE activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   uuid NOT NULL,
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  diff        jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- notifications (S7 Collaboration) --------------------------------------
CREATE TABLE notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type          text NOT NULL,
  title         text NOT NULL,
  body          text,
  entity_type   text,
  entity_id     uuid,
  channel       text NOT NULL DEFAULT 'in_app',
  is_read       boolean NOT NULL DEFAULT false,
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- custom_field_definitions (S6 Advanced Test Cases) ----------------------
CREATE TABLE custom_field_definitions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  field_type  text NOT NULL,
  options     jsonb,
  is_required boolean NOT NULL DEFAULT false,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_custom_field_definitions_updated_at
  BEFORE UPDATE ON custom_field_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- custom_field_values (S6 Advanced Test Cases) ---------------------------
CREATE TABLE custom_field_values (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_definition_id   uuid NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  test_case_id          uuid NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  value                 jsonb NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(field_definition_id, test_case_id)
);

CREATE TRIGGER trg_custom_field_values_updated_at
  BEFORE UPDATE ON custom_field_values
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- test_case_dependencies (S6 Advanced Test Cases) ------------------------
CREATE TABLE test_case_dependencies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id    uuid NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  depends_on_id   uuid NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(test_case_id, depends_on_id),
  CHECK(test_case_id != depends_on_id)
);

-- ---------------------------------------------------------------------------
-- Domain functions
-- ---------------------------------------------------------------------------

-- Atomically generate the next display_id for a suite
CREATE OR REPLACE FUNCTION generate_test_case_id(p_suite_id uuid)
RETURNS TABLE(display_id text, sequence_number integer) AS $$
DECLARE
  v_prefix text;
  v_seq    integer;
BEGIN
  SELECT s.prefix, s.next_sequence
    INTO v_prefix, v_seq
    FROM suites s
   WHERE s.id = p_suite_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suite % not found', p_suite_id;
  END IF;

  UPDATE suites SET next_sequence = next_sequence + 1 WHERE id = p_suite_id;

  display_id := v_prefix || '-' || v_seq;
  sequence_number := v_seq;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION create_profile_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  v_email     text;
  v_full_name text;
  v_avatar    text;
  v_role      public.user_role;
BEGIN
  v_email     := NEW.email;
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(v_email, '@', 1)
  );
  v_avatar := NEW.raw_user_meta_data->>'avatar_url';

  SELECT i.role INTO v_role
    FROM public.invitations i
   WHERE i.email = v_email
     AND i.status = 'pending'
   ORDER BY i.created_at DESC
   LIMIT 1;

  IF v_role IS NOT NULL THEN
    UPDATE public.invitations
       SET status = 'accepted', accepted_at = now()
     WHERE email = v_email AND status = 'pending';
  ELSE
    v_role := 'viewer';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (NEW.id, v_email, v_full_name, v_avatar, v_role);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_profile_on_signup();

-- Snapshot test case version on update
CREATE OR REPLACE FUNCTION snapshot_test_case_version()
RETURNS TRIGGER AS $$
DECLARE
  v_version  integer;
  v_snapshot jsonb;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
    INTO v_version
    FROM public.test_case_versions
   WHERE test_case_id = NEW.id;

  SELECT jsonb_build_object(
    'title', NEW.title,
    'description', NEW.description,
    'precondition', NEW.precondition,
    'type', NEW.type::text,
    'automation_status', NEW.automation_status::text,
    'automation_file_path', NEW.automation_file_path,
    'platform_tags', to_jsonb(NEW.platform_tags),
    'priority', NEW.priority,
    'tags', to_jsonb(NEW.tags),
    'metadata', NEW.metadata,
    'steps', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'step_number', ts.step_number,
          'description', ts.description,
          'test_data', ts.test_data,
          'expected_result', ts.expected_result,
          'is_automation_only', ts.is_automation_only
        ) ORDER BY ts.step_number
      )
      FROM public.test_steps ts WHERE ts.test_case_id = NEW.id
    ), '[]'::jsonb)
  ) INTO v_snapshot;

  INSERT INTO public.test_case_versions (test_case_id, version_number, snapshot, changed_by)
  VALUES (NEW.id, v_version, v_snapshot, COALESCE(NEW.updated_by, NEW.created_by));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_test_case_version
  AFTER UPDATE ON test_cases
  FOR EACH ROW EXECUTE FUNCTION snapshot_test_case_version();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

-- Helper: get the role of the current authenticated user
CREATE OR REPLACE FUNCTION auth_role()
RETURNS public.user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- profiles ---------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR auth_role() = 'admin')
  WITH CHECK (id = auth.uid() OR auth_role() = 'admin');

CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE TO authenticated
  USING (auth_role() = 'admin');

-- invitations ------------------------------------------------------------
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations_select" ON invitations
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

CREATE POLICY "invitations_insert" ON invitations
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "invitations_update" ON invitations
  FOR UPDATE TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "invitations_delete" ON invitations
  FOR DELETE TO authenticated
  USING (auth_role() = 'admin');

-- projects ---------------------------------------------------------------
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select" ON projects
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "projects_insert" ON projects
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() IN ('admin', 'qa_engineer', 'sdet'));

CREATE POLICY "projects_update" ON projects
  FOR UPDATE TO authenticated
  USING (auth_role() IN ('admin', 'qa_engineer', 'sdet'))
  WITH CHECK (auth_role() IN ('admin', 'qa_engineer', 'sdet'));

CREATE POLICY "projects_delete" ON projects
  FOR DELETE TO authenticated
  USING (auth_role() = 'admin');

-- suites -----------------------------------------------------------------
ALTER TABLE suites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suites_select" ON suites
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "suites_insert" ON suites
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() IN ('admin', 'qa_engineer', 'sdet'));

CREATE POLICY "suites_update" ON suites
  FOR UPDATE TO authenticated
  USING (auth_role() IN ('admin', 'qa_engineer', 'sdet'))
  WITH CHECK (auth_role() IN ('admin', 'qa_engineer', 'sdet'));

CREATE POLICY "suites_delete" ON suites
  FOR DELETE TO authenticated
  USING (auth_role() = 'admin');

-- test_cases -------------------------------------------------------------
ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "test_cases_select" ON test_cases
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "test_cases_insert" ON test_cases
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() IN ('admin', 'qa_engineer', 'sdet'));

CREATE POLICY "test_cases_update" ON test_cases
  FOR UPDATE TO authenticated
  USING (auth_role() IN ('admin', 'qa_engineer', 'sdet'))
  WITH CHECK (auth_role() IN ('admin', 'qa_engineer', 'sdet'));

CREATE POLICY "test_cases_delete" ON test_cases
  FOR DELETE TO authenticated
  USING (auth_role() = 'admin');

-- test_steps -------------------------------------------------------------
ALTER TABLE test_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "test_steps_select" ON test_steps
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "test_steps_insert" ON test_steps
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() IN ('admin', 'qa_engineer', 'sdet'));

CREATE POLICY "test_steps_update" ON test_steps
  FOR UPDATE TO authenticated
  USING (auth_role() IN ('admin', 'qa_engineer', 'sdet'))
  WITH CHECK (auth_role() IN ('admin', 'qa_engineer', 'sdet'));

CREATE POLICY "test_steps_delete" ON test_steps
  FOR DELETE TO authenticated
  USING (auth_role() = 'admin');

-- test_runs --------------------------------------------------------------
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "test_runs_select" ON test_runs
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "test_runs_insert" ON test_runs
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() IN ('admin', 'qa_engineer', 'sdet'));

CREATE POLICY "test_runs_update" ON test_runs
  FOR UPDATE TO authenticated
  USING (auth_role() IN ('admin', 'qa_engineer', 'sdet'))
  WITH CHECK (auth_role() IN ('admin', 'qa_engineer', 'sdet'));

CREATE POLICY "test_runs_delete" ON test_runs
  FOR DELETE TO authenticated
  USING (auth_role() = 'admin');

-- test_run_cases ---------------------------------------------------------
ALTER TABLE test_run_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "test_run_cases_select" ON test_run_cases
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "test_run_cases_insert" ON test_run_cases
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() IN ('admin', 'qa_engineer', 'sdet'));

CREATE POLICY "test_run_cases_update" ON test_run_cases
  FOR UPDATE TO authenticated
  USING (auth_role() IN ('admin', 'qa_engineer', 'sdet'))
  WITH CHECK (auth_role() IN ('admin', 'qa_engineer', 'sdet'));

CREATE POLICY "test_run_cases_delete" ON test_run_cases
  FOR DELETE TO authenticated
  USING (auth_role() = 'admin');

-- execution_results ------------------------------------------------------
ALTER TABLE execution_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "execution_results_select" ON execution_results
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "execution_results_insert" ON execution_results
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() IN ('admin', 'qa_engineer', 'sdet'));

CREATE POLICY "execution_results_update" ON execution_results
  FOR UPDATE TO authenticated
  USING (auth_role() IN ('admin', 'qa_engineer', 'sdet'))
  WITH CHECK (auth_role() IN ('admin', 'qa_engineer', 'sdet'));

CREATE POLICY "execution_results_delete" ON execution_results
  FOR DELETE TO authenticated
  USING (auth_role() = 'admin');

-- annotations ------------------------------------------------------------
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "annotations_select" ON annotations
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "annotations_insert" ON annotations
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() IN ('admin', 'qa_engineer', 'sdet'));

CREATE POLICY "annotations_update" ON annotations
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR auth_role() = 'admin')
  WITH CHECK (created_by = auth.uid() OR auth_role() = 'admin');

CREATE POLICY "annotations_delete" ON annotations
  FOR DELETE TO authenticated
  USING (auth_role() = 'admin');

-- attachments ------------------------------------------------------------
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attachments_select" ON attachments
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "attachments_insert" ON attachments
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() IN ('admin', 'qa_engineer', 'sdet'));

CREATE POLICY "attachments_delete" ON attachments
  FOR DELETE TO authenticated
  USING (
    auth_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM annotations a
      WHERE a.id = attachments.annotation_id AND a.created_by = auth.uid()
    )
  );

-- test_case_versions -----------------------------------------------------
ALTER TABLE test_case_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "test_case_versions_select" ON test_case_versions
  FOR SELECT TO authenticated
  USING (true);

-- bug_links --------------------------------------------------------------
ALTER TABLE bug_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bug_links_select" ON bug_links
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "bug_links_insert" ON bug_links
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() IN ('admin', 'qa_engineer', 'sdet'));

CREATE POLICY "bug_links_update" ON bug_links
  FOR UPDATE TO authenticated
  USING (auth_role() IN ('admin', 'qa_engineer', 'sdet'))
  WITH CHECK (auth_role() IN ('admin', 'qa_engineer', 'sdet'));

CREATE POLICY "bug_links_delete" ON bug_links
  FOR DELETE TO authenticated
  USING (auth_role() = 'admin');

-- csv_imports ------------------------------------------------------------
ALTER TABLE csv_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "csv_imports_select" ON csv_imports
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "csv_imports_insert" ON csv_imports
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() IN ('admin', 'qa_engineer', 'sdet'));

CREATE POLICY "csv_imports_update" ON csv_imports
  FOR UPDATE TO authenticated
  USING (auth_role() IN ('admin', 'qa_engineer', 'sdet'))
  WITH CHECK (auth_role() IN ('admin', 'qa_engineer', 'sdet'));

-- csv_import_errors ------------------------------------------------------
ALTER TABLE csv_import_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "csv_import_errors_select" ON csv_import_errors
  FOR SELECT TO authenticated
  USING (true);

-- webhook_events ---------------------------------------------------------
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_events_select" ON webhook_events
  FOR SELECT TO authenticated
  USING (auth_role() IN ('admin', 'sdet'));

-- grid_column_preferences ------------------------------------------------
ALTER TABLE grid_column_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grid_prefs_select" ON grid_column_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "grid_prefs_insert" ON grid_column_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "grid_prefs_update" ON grid_column_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "grid_prefs_delete" ON grid_column_preferences
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Future placeholder tables: enable RLS with SELECT policies for authenticated users
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_case_dependencies ENABLE ROW LEVEL SECURITY;

-- SELECT policies for future tables (ready for S-feature activation)
CREATE POLICY integrations_select ON integrations FOR SELECT TO authenticated USING (true);
CREATE POLICY comments_select ON comments FOR SELECT TO authenticated USING (true);
CREATE POLICY activity_log_select ON activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY notifications_select ON notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());
CREATE POLICY custom_field_definitions_select ON custom_field_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY custom_field_values_select ON custom_field_values FOR SELECT TO authenticated USING (true);
CREATE POLICY test_case_dependencies_select ON test_case_dependencies FOR SELECT TO authenticated USING (true);
