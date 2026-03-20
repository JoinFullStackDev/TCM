import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlaywrightWebhookPayload } from '@/lib/validations/webhook';
import type { ExecutionStatus } from '@/types/database';

interface ProcessResult {
  success: boolean;
  test_run_id?: string;
  error?: string;
  matched_cases: number;
  unmatched_cases: string[];
}

async function processCases(
  supabase: SupabaseClient,
  eventId: string,
  runId: string,
  payload: PlaywrightWebhookPayload,
): Promise<ProcessResult> {
  const { results } = payload;

  const displayIds = results.map((r) => r.test_case_id);
  const { data: testCases } = await supabase
    .from('test_cases')
    .select('id, display_id, suite_id')
    .in('display_id', displayIds);

  const caseMap = new Map(
    (testCases ?? []).map((tc) => [tc.display_id, tc]),
  );

  let matchedCases = 0;
  const unmatchedCases: string[] = [];

  for (const result of results) {
    const tc = caseMap.get(result.test_case_id);
    if (!tc) {
      unmatchedCases.push(result.test_case_id);
      continue;
    }

    matchedCases++;

    await supabase.from('test_run_cases').insert({
      test_run_id: runId,
      test_case_id: tc.id,
      overall_status: result.status as ExecutionStatus,
    });

    if (result.steps && result.steps.length > 0) {
      const { data: existingSteps } = await supabase
        .from('test_steps')
        .select('id, step_number')
        .eq('test_case_id', tc.id);

      const stepMap = new Map(
        (existingSteps ?? []).map((s) => [s.step_number, s.id]),
      );

      for (const step of result.steps) {
        const stepId = stepMap.get(step.step_number);
        if (!stepId) continue;

        await supabase.from('execution_results').insert({
          test_run_id: runId,
          test_case_id: tc.id,
          test_step_id: stepId,
          platform: 'desktop',
          browser: 'chromium',
          status: step.status as ExecutionStatus,
          executed_at: new Date().toISOString(),
        });
      }
    }
  }

  const now = new Date().toISOString();
  await supabase
    .from('webhook_events')
    .update({
      status: 'success',
      test_run_id: runId,
      processed_at: now,
      error_message: unmatchedCases.length > 0
        ? `Unmatched test cases: ${unmatchedCases.join(', ')}`
        : null,
    })
    .eq('id', eventId);

  return {
    success: true,
    test_run_id: runId,
    matched_cases: matchedCases,
    unmatched_cases: unmatchedCases,
  };
}

export async function processPlaywrightWebhook(
  supabase: SupabaseClient,
  eventId: string,
  payload: PlaywrightWebhookPayload,
): Promise<ProcessResult> {
  const { project_id, results, run_name, metadata } = payload;

  const { data: project, error: projErr } = await supabase
    .from('projects')
    .select('id')
    .eq('id', project_id)
    .single();

  if (projErr || !project) {
    return { success: false, error: `Project ${project_id} not found`, matched_cases: 0, unmatched_cases: [] };
  }

  // If test_run_id is provided, update the existing CI-triggered run
  const ciRunId = metadata?.test_run_id ?? undefined;
  if (ciRunId) {
    const { data: existingRun, error: runFetchErr } = await supabase
      .from('test_runs')
      .select('id, status, project_id')
      .eq('id', ciRunId)
      .single();

    if (runFetchErr || !existingRun) {
      await supabase.from('webhook_events').update({
        status: 'failed',
        processed_at: new Date().toISOString(),
        error_message: `Run ${ciRunId} not found`,
      }).eq('id', eventId);
      return { success: false, error: `Run ${ciRunId} not found`, matched_cases: 0, unmatched_cases: [] };
    }

    if (existingRun.project_id !== project_id) {
      await supabase.from('webhook_events').update({
        status: 'failed',
        processed_at: new Date().toISOString(),
        error_message: 'Run project mismatch',
      }).eq('id', eventId);
      return { success: false, error: 'Run project mismatch', matched_cases: 0, unmatched_cases: [] };
    }

    if (existingRun.status === 'completed' || existingRun.status === 'aborted') {
      await supabase.from('webhook_events').update({
        status: 'failed',
        processed_at: new Date().toISOString(),
        error_message: 'Run already finalized',
      }).eq('id', eventId);
      return { success: false, error: 'Run already finalized', matched_cases: 0, unmatched_cases: [] };
    }

    // Remove stale not_run placeholders before inserting fresh results
    await supabase
      .from('test_run_cases')
      .delete()
      .eq('test_run_id', ciRunId)
      .eq('overall_status', 'not_run');

    // Mark run as completed
    await supabase
      .from('test_runs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', ciRunId);

    return processCases(supabase, eventId, ciRunId, payload);
  }

  // No test_run_id — create a new run (existing behavior)
  const runDisplayName =
    run_name ?? `Playwright Run ${new Date().toISOString().split('T')[0]}`;

  const { data: testRun, error: runErr } = await supabase
    .from('test_runs')
    .insert({
      project_id,
      name: runDisplayName,
      description: metadata?.ci_url
        ? `Automated run from CI: ${metadata.ci_url}`
        : 'Automated run from Playwright webhook',
      environment: (metadata?.environment as string) ?? null,
      gitlab_pipeline_url: (metadata?.ci_url as string) ?? null,
      status: 'completed',
      is_automated: true,
      source: 'playwright_webhook',
      completed_at: new Date().toISOString(),
      created_by: null,
    })
    .select()
    .single();

  if (runErr || !testRun) {
    return { success: false, error: `Failed to create test run: ${runErr?.message}`, matched_cases: 0, unmatched_cases: [] };
  }

  return processCases(supabase, eventId, testRun.id, payload);
}
