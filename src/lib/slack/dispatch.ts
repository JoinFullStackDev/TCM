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
