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
  /** stepId → most recent annotation comment from the latest completed test run */
  annotationMap?: Record<string, string>;
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

/**
 * Fetch the most recent annotation comment per test step from the latest completed
 * test run for a project.
 *
 * Returns a map of stepId → comment text. Steps with no annotation are absent from
 * the map. If no completed run exists, returns an empty map.
 *
 * Query path: test_runs → execution_results (test_run_id) → annotations (execution_result_id)
 */
export async function fetchAnnotationMap(projectId: string): Promise<Record<string, string>> {
  const supabase = await createServiceClient();

  // Find the latest completed run for this project
  const { data: latestRun } = await supabase
    .from('test_runs')
    .select('id')
    .eq('project_id', projectId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestRun) return {};

  // Fetch all execution_results for this run (id → test_step_id)
  const { data: erRows } = await supabase
    .from('execution_results')
    .select('id, test_step_id')
    .eq('test_run_id', latestRun.id);

  if (!erRows || erRows.length === 0) return {};

  const erIds = erRows.map((er: { id: string; test_step_id: string }) => er.id);
  const erStepMap = new Map(
    erRows.map((er: { id: string; test_step_id: string }) => [er.id, er.test_step_id]),
  );

  // Fetch annotations ordered most-recent first; we take the first per step
  const { data: annRows } = await supabase
    .from('annotations')
    .select('execution_result_id, comment')
    .in('execution_result_id', erIds)
    .not('comment', 'is', null)
    .order('created_at', { ascending: false });

  if (!annRows) return {};

  const map: Record<string, string> = {};
  for (const ann of annRows as Array<{ execution_result_id: string; comment: string }>) {
    const stepId = erStepMap.get(ann.execution_result_id);
    if (stepId && !map[stepId] && ann.comment) {
      map[stepId] = ann.comment;
    }
  }

  return map;
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
