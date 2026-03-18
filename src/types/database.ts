export type UserRole = 'admin' | 'qa_engineer' | 'sdet' | 'viewer';
export type NoteVisibility = 'private' | 'team';
export type TestCaseType = 'functional' | 'performance';
export type AutomationStatus = 'not_automated' | 'scripted' | 'in_cicd' | 'out_of_sync';
export type ExecutionStatus = 'not_run' | 'pass' | 'fail' | 'blocked' | 'skip';
export type Platform = 'desktop' | 'tablet' | 'mobile';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export type TestRunStatus = 'planned' | 'in_progress' | 'completed' | 'aborted';
export type WebhookEventStatus = 'pending' | 'processing' | 'success' | 'failed';
export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type TestCaseCategory = 'smoke' | 'regression' | 'integration' | 'e2e' | 'unit' | 'acceptance' | 'exploratory' | 'performance' | 'security' | 'usability';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: UserRole;
  invited_by: string;
  token: string;
  status: InvitationStatus;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  is_archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Suite {
  id: string;
  project_id: string;
  name: string;
  prefix: string;
  description: string | null;
  color_index: number;
  position: number;
  next_sequence: number;
  tags: string[];
  group: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TestCase {
  id: string;
  suite_id: string;
  display_id: string;
  sequence_number: number;
  title: string;
  description: string | null;
  precondition: string | null;
  type: TestCaseType;
  automation_status: AutomationStatus;
  automation_file_path: string | null;
  platform_tags: Platform[];
  priority: Priority | null;
  tags: string[];
  position: number;
  metadata: Record<string, unknown>;
  category: TestCaseCategory | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestStep {
  id: string;
  test_case_id: string;
  step_number: number;
  description: string;
  test_data: string | null;
  expected_result: string | null;
  is_automation_only: boolean;
  category: TestCaseCategory | null;
  created_at: string;
  updated_at: string;
}

export interface TestRun {
  id: string;
  project_id: string;
  suite_id: string | null;
  name: string;
  description: string | null;
  target_version: string | null;
  environment: string | null;
  status: TestRunStatus;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  is_automated: boolean;
  source: string;
  assignee_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TestRunCase {
  id: string;
  test_run_id: string;
  test_case_id: string;
  overall_status: ExecutionStatus;
  created_at: string;
}

export interface ExecutionResult {
  id: string;
  test_run_id: string;
  test_case_id: string;
  test_step_id: string;
  platform: Platform;
  browser: string;
  status: ExecutionStatus;
  executed_by: string | null;
  executed_at: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

export interface Annotation {
  id: string;
  execution_result_id: string;
  comment: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: string;
  annotation_id: string;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface TestCaseVersion {
  id: string;
  test_case_id: string;
  version_number: number;
  snapshot: Record<string, unknown>;
  changed_by: string;
  change_summary: string | null;
  created_at: string;
}

export interface BugLink {
  id: string;
  test_case_id: string;
  url: string;
  title: string | null;
  external_id: string | null;
  external_status: string | null;
  provider: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CsvImport {
  id: string;
  project_id: string;
  suite_id: string | null;
  file_name: string;
  file_size: number | null;
  column_mappings: Record<string, unknown> | null;
  total_rows: number | null;
  imported_count: number;
  skipped_count: number;
  error_count: number;
  status: ImportStatus;
  imported_by: string;
  completed_at: string | null;
  created_at: string;
}

export interface CsvImportError {
  id: string;
  import_id: string;
  row_number: number | null;
  column_name: string | null;
  error_message: string;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export interface WebhookEvent {
  id: string;
  project_id: string;
  test_run_id: string | null;
  provider: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: WebhookEventStatus;
  error_message: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface GridColumnPreferences {
  id: string;
  user_id: string;
  project_id: string;
  suite_id: string | null;
  column_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type IntegrationType = 'slack' | 'gitlab';

export interface SlackConfig {
  webhook_url: string;
  channel: string;
  failure_threshold: number;
  mention_usergroups: string[];
  notify_on: 'all' | 'failures_only';
}

export interface Integration {
  id: string;
  project_id: string;
  suite_id: string | null;
  type: IntegrationType;
  config: SlackConfig | Record<string, unknown>;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardPreferences {
  id: string;
  user_id: string;
  card_config: DashboardCardConfig[];
  created_at: string;
  updated_at: string;
}

export interface DashboardCardConfig {
  card_id: string;
  visible: boolean;
  position: number;
}

export interface DashboardMyAssignedRun {
  id: string;
  name: string;
  status: string;
  created_at: string;
  project_name: string;
  total_cases: number;
  executed_cases: number;
}

export interface DashboardRecentActivity {
  id: string;
  status: string;
  platform: string;
  executed_at: string | null;
  display_id: string;
  test_case_title: string;
  run_name: string;
  test_run_id: string;
}

export interface DashboardMyStats {
  executions_this_week: number;
  executions_this_month: number;
  pass_rate_30d: number;
  total_executed_30d: number;
}

export interface DashboardActiveProject {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  suite_count: number;
  test_case_count: number;
}

export interface DashboardRunOverview {
  planned: number;
  in_progress: number;
  completed: number;
  aborted: number;
}

export interface DashboardRecentRun {
  id: string;
  name: string;
  status: string;
  created_at: string;
  project_name: string;
}

export interface DashboardPassRateSummary {
  pass_rate: number;
  total_cases: number;
  passed: number;
  failed: number;
  completed_runs: number;
}

export interface DashboardPlatformCoverage {
  platform: string;
  total: number;
  pass: number;
  fail: number;
  pass_rate: number;
}

export interface DashboardUserActivity {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  is_active: boolean;
  last_active_at: string | null;
}

export interface DashboardPendingInvitation {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
}

export interface DashboardSystemStats {
  users: number;
  projects: number;
  suites: number;
  test_cases: number;
  test_runs: number;
  executions: number;
}

export interface DashboardWebhookHealth {
  success: number;
  failed: number;
  pending: number;
  processing: number;
  total: number;
}

export interface DashboardImportActivity {
  id: string;
  file_name: string;
  status: string;
  imported_count: number;
  skipped_count: number;
  error_count: number;
  total_rows: number | null;
  created_at: string;
  project_name: string;
}

export interface DashboardUserSection {
  my_assigned_runs: DashboardMyAssignedRun[];
  my_recent_activity: DashboardRecentActivity[];
  my_stats: DashboardMyStats;
}

export interface DashboardGlobalSection {
  active_projects: DashboardActiveProject[];
  run_overview: DashboardRunOverview;
  recent_runs: DashboardRecentRun[];
  pass_rate_summary: DashboardPassRateSummary;
  platform_coverage: DashboardPlatformCoverage[];
}

export interface DashboardAdminSection {
  user_activity: DashboardUserActivity[];
  pending_invitations: DashboardPendingInvitation[];
  system_stats: DashboardSystemStats;
  webhook_health: DashboardWebhookHealth;
  import_activity: DashboardImportActivity[];
}

export interface Note {
  id: string;
  author_id: string;
  title: string | null;
  content: string;
  content_plain: string | null;
  summary: string | null;
  visibility: NoteVisibility;
  meeting_url: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface NoteAttachment {
  id: string;
  note_id: string;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface NoteTestCaseLink {
  id: string;
  note_id: string;
  test_case_id: string;
  created_at: string;
}

export interface LinkedTestCase {
  id: string;
  display_id: string;
  title: string;
  suite_id: string;
  project_id: string;
}

export interface NoteWithAttachments extends Note {
  note_attachments: NoteAttachment[];
  author?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'email'>;
  linked_test_cases?: LinkedTestCase[];
}

export interface DashboardSummary {
  user_section: DashboardUserSection;
  global_section: DashboardGlobalSection;
  admin_section: DashboardAdminSection | null;
}
