import { createServiceClient } from '@/lib/supabase/server';

export interface ExportStep {
  id: string;
  test_case_id: string;
  step_number: number;
  description: string | null;
  test_data: string | null;
  expected_result: string | null;
  is_automation_only: boolean;
}

export interface ExportBugLink {
  test_case_id: string;
  url: string;
  external_id: string | null;
  title: string | null;
}

export interface ExportTestCase {
  id: string;
  display_id: string;
  title: string;
  description: string | null;
  precondition: string | null;
  position: number;
  automation_status: string | null;
  steps: ExportStep[] | null;
  bug_links: ExportBugLink[] | null;
}

export interface ExportSuite {
  id: string;
  name: string;
  position: number;
  color_index: number;
  prefix: string;
  test_cases: ExportTestCase[] | null;
}

export interface ExportSnapshot {
  suites: ExportSuite[];
}

/**
 * Fetch a point-in-time snapshot for a full project export.
 * Uses export_project_snapshot RPC for REPEATABLE READ consistency.
 */
export async function fetchProjectSnapshot(projectId: string): Promise<ExportSnapshot> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc('export_project_snapshot', {
    p_project_id: projectId,
  });
  if (error) throw new Error(`Failed to fetch project snapshot: ${error.message}`);
  const result = data as ExportSnapshot;
  return {
    suites: (result.suites ?? []).map(normalizeSuite),
  };
}

/**
 * Fetch a point-in-time snapshot for a single suite export.
 * Uses export_suite_snapshot RPC for REPEATABLE READ consistency.
 */
export async function fetchSuiteSnapshot(suiteId: string): Promise<ExportSnapshot> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc('export_suite_snapshot', {
    p_suite_id: suiteId,
  });
  if (error) throw new Error(`Failed to fetch suite snapshot: ${error.message}`);
  const result = data as ExportSnapshot;
  return {
    suites: (result.suites ?? []).map(normalizeSuite),
  };
}

/**
 * Count test cases for a project (used for sync/async threshold check).
 */
export async function countProjectTestCases(projectId: string): Promise<number> {
  const supabase = await createServiceClient();
  const { data: suites } = await supabase
    .from('suites')
    .select('id')
    .eq('project_id', projectId);
  if (!suites || suites.length === 0) return 0;
  const suiteIds = suites.map((s: { id: string }) => s.id);
  const { count, error } = await supabase
    .from('test_cases')
    .select('id', { count: 'exact', head: true })
    .in('suite_id', suiteIds)
    .is('deleted_at', null);
  if (error) throw new Error(`Failed to count test cases: ${error.message}`);
  return count ?? 0;
}

/**
 * Count test cases for a single suite.
 */
export async function countSuiteTestCases(suiteId: string): Promise<number> {
  const supabase = await createServiceClient();
  const { count, error } = await supabase
    .from('test_cases')
    .select('id', { count: 'exact', head: true })
    .eq('suite_id', suiteId)
    .is('deleted_at', null);
  if (error) throw new Error(`Failed to count test cases: ${error.message}`);
  return count ?? 0;
}

function normalizeSuite(s: ExportSuite): ExportSuite {
  return {
    ...s,
    color_index: s.color_index ?? 0,
    test_cases: (s.test_cases ?? []).map((tc) => ({
      ...tc,
      steps: tc.steps ?? [],
      bug_links: tc.bug_links ?? [],
    })),
  };
}
