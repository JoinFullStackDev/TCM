import { sendRunCompletionNotification } from '@/lib/slack/notify';
import type { SlackConfig } from '@/types/database';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function dispatchSlackNotifications(runId: string, appUrl: string) {
  const supabase = getServiceClient();

  const { data: run, error: runErr } = await supabase
    .from('test_runs')
    .select('id, name, project_id, suite_id, environment, target_version, status, projects(name)')
    .eq('id', runId)
    .single();

  if (runErr || !run) {
    console.error('[Slack dispatch] Could not fetch run:', runErr?.message);
    return;
  }

  const projectName =
    (run.projects as unknown as { name: string } | null)?.name ?? 'Unknown Project';

  const { data: integrations, error: intErr } = await supabase
    .from('integrations')
    .select('config, suite_id')
    .eq('project_id', run.project_id)
    .eq('type', 'slack')
    .eq('is_active', true);

  if (intErr) {
    console.error('[Slack dispatch] Could not fetch integrations:', intErr.message);
    return;
  }

  if (!integrations || integrations.length === 0) {
    console.log('[Slack dispatch] No active Slack integrations for project', run.project_id);
    return;
  }

  const applicable = integrations.filter((i) => {
    if (!i.suite_id) return true;
    return i.suite_id === run.suite_id;
  });

  if (applicable.length === 0) {
    console.log('[Slack dispatch] No integrations match suite scope for run', runId);
    return;
  }

  const { data: runCases } = await supabase
    .from('test_run_cases')
    .select('overall_status')
    .eq('test_run_id', runId);

  const totalCases = runCases?.length ?? 0;
  const counts = { pass: 0, fail: 0, blocked: 0, skip: 0, not_run: 0 };
  for (const rc of runCases ?? []) {
    const s = rc.overall_status as keyof typeof counts;
    if (s in counts) counts[s]++;
  }

  const passRate = totalCases > 0 ? Math.round((counts.pass / totalCases) * 100) : 0;

  const caseIds = (runCases ?? []).map((rc) => {
    const raw = rc as unknown as Record<string, string>;
    return raw.test_case_id;
  });

  const { data: trcRows } = await supabase
    .from('test_run_cases')
    .select('test_case_id')
    .eq('test_run_id', runId);

  const runCaseIds = (trcRows ?? []).map((r) => r.test_case_id);

  let totalStepsInRun = 0;
  if (runCaseIds.length > 0) {
    const { count } = await supabase
      .from('test_steps')
      .select('id', { count: 'exact', head: true })
      .in('test_case_id', runCaseIds);
    totalStepsInRun = count ?? 0;
  }

  const { data: stepResults } = await supabase
    .from('execution_results')
    .select('status, platform, browser, test_case_id, test_step_id')
    .eq('test_run_id', runId);

  const executed = { pass: 0, fail: 0, blocked: 0, skip: 0, not_run: 0 };
  const failedStepIds: { test_case_id: string; test_step_id: string; platform: string; browser: string }[] = [];

  for (const r of stepResults ?? []) {
    const s = r.status as keyof typeof executed;
    if (s in executed) executed[s]++;
    if (r.status === 'fail') {
      failedStepIds.push({
        test_case_id: r.test_case_id,
        test_step_id: r.test_step_id,
        platform: r.platform,
        browser: r.browser,
      });
    }
  }

  const totalExecuted = executed.pass + executed.fail + executed.blocked + executed.skip + executed.not_run;
  const untested = Math.max(0, totalStepsInRun - totalExecuted);
  const stepCounts = {
    total: totalStepsInRun,
    pass: executed.pass,
    fail: executed.fail,
    blocked: executed.blocked,
    skip: executed.skip,
    not_run: executed.not_run + untested,
  };

  const stepPassRate = totalStepsInRun > 0 ? Math.round((stepCounts.pass / totalStepsInRun) * 100) : 0;

  let failedSteps: { displayId: string; stepNumber: number; description: string; platform: string; browser: string }[] = [];

  if (failedStepIds.length > 0) {
    const caseIds = [...new Set(failedStepIds.map((f) => f.test_case_id))];
    const stepIds = [...new Set(failedStepIds.map((f) => f.test_step_id))];

    const { data: cases } = await supabase
      .from('test_cases')
      .select('id, display_id')
      .in('id', caseIds);

    const { data: steps } = await supabase
      .from('test_steps')
      .select('id, step_number, description')
      .in('id', stepIds);

    const caseMap = new Map((cases ?? []).map((c) => [c.id, c.display_id]));
    const stepMap = new Map((steps ?? []).map((s) => [s.id, { step_number: s.step_number, description: s.description }]));

    failedSteps = failedStepIds.map((f) => ({
      displayId: caseMap.get(f.test_case_id) ?? '??',
      stepNumber: stepMap.get(f.test_step_id)?.step_number ?? 0,
      description: stepMap.get(f.test_step_id)?.description ?? '',
      platform: f.platform,
      browser: f.browser,
    })).sort((a, b) => a.displayId.localeCompare(b.displayId) || a.stepNumber - b.stepNumber);
  }

  const summary = {
    runId: run.id,
    runName: run.name,
    projectName,
    environment: run.environment,
    targetVersion: run.target_version,
    status: run.status,
    totalCases,
    ...counts,
    passRate,
    steps: stepCounts,
    stepPassRate,
    failedSteps,
  };

  console.log('[Slack dispatch] Sending to', applicable.length, 'integration(s) for run:', run.name);

  const results = await Promise.allSettled(
    applicable.map((i) =>
      sendRunCompletionNotification(i.config as SlackConfig, summary, appUrl),
    ),
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[Slack dispatch] Failed to send notification:', result.reason);
    } else {
      console.log('[Slack dispatch] Notification sent successfully');
    }
  }
}
