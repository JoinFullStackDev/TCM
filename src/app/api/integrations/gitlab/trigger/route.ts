import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import type { GitLabCIConfig } from '@/types/database';

const bodySchema = z.object({
  integration_id: z.string().uuid(),
  suite_id: z.string().uuid(),
  environment: z.enum(['dev', 'qa', 'uat']),
  tag_filter: z.enum(['smoke', 'regression', 'all']).optional().default('all'),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'sdet'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body', details: err }, { status: 400 });
  }

  const { integration_id, suite_id, environment, tag_filter } = body;

  // Fetch integration
  const { data: integration, error: intErr } = await supabase
    .from('integrations')
    .select('*')
    .eq('id', integration_id)
    .single();

  if (intErr || !integration) {
    return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
  }

  if (integration.type !== 'gitlab' || !integration.is_active) {
    return NextResponse.json({ error: 'Integration is not an active GitLab CI integration' }, { status: 400 });
  }

  // Fetch suite to verify it belongs to same project as integration
  const { data: suite, error: suiteErr } = await supabase
    .from('suites')
    .select('id, name, project_id')
    .eq('id', suite_id)
    .single();

  if (suiteErr || !suite) {
    return NextResponse.json({ error: 'Suite not found' }, { status: 404 });
  }

  if (suite.project_id !== integration.project_id) {
    return NextResponse.json({ error: 'Suite does not belong to the integration project' }, { status: 403 });
  }

  // Fetch in_cicd test cases
  const { data: testCases } = await supabase
    .from('test_cases')
    .select('id, display_id')
    .eq('suite_id', suite_id)
    .eq('automation_status', 'in_cicd');

  if (!testCases || testCases.length === 0) {
    return NextResponse.json({ error: 'No automated test cases found in this suite' }, { status: 400 });
  }

  const testIdsRegex = `(${testCases.map((tc) => tc.display_id).join('|')})`;

  // Create the test run
  const runName = `${suite.name} – ${environment.toUpperCase()}`;
  const { data: testRun, error: runErr } = await supabase
    .from('test_runs')
    .insert({
      project_id: integration.project_id,
      suite_id,
      name: runName,
      environment,
      status: 'in_progress',
      is_automated: true,
      source: 'ci_trigger',
      created_by: user.id,
    })
    .select()
    .single();

  if (runErr || !testRun) {
    return NextResponse.json({ error: `Failed to create test run: ${runErr?.message}` }, { status: 500 });
  }

  // Add all matched test cases to test_run_cases with not_run status
  const runCaseInserts = testCases.map((tc) => ({
    test_run_id: testRun.id,
    test_case_id: tc.id,
    overall_status: 'not_run',
  }));

  await supabase.from('test_run_cases').insert(runCaseInserts);

  // Call GitLab trigger API
  const cfg = integration.config as GitLabCIConfig;
  const formData = new FormData();
  formData.append('token', cfg.trigger_token);
  formData.append('ref', environment);
  formData.append('variables[TARGET_BRANCH]', environment);
  formData.append('variables[TEST_IDs_REGEX]', testIdsRegex);
  formData.append('variables[ENVIRONMENT]', environment);
  formData.append('variables[TEST_RUN_ID]', testRun.id);
  if (tag_filter && tag_filter !== 'all') {
    formData.append('variables[TEST_TAG]', tag_filter);
  }

  let gitlabRes: Response;
  try {
    gitlabRes = await fetch(cfg.trigger_url, { method: 'POST', body: formData });
  } catch (fetchErr) {
    // Network error — abort the run
    await supabase.from('test_runs').update({
      status: 'aborted',
      description: `Failed to reach GitLab: ${String(fetchErr)}`,
    }).eq('id', testRun.id);
    return NextResponse.json({ error: 'Failed to reach GitLab trigger URL' }, { status: 502 });
  }

  if (!gitlabRes.ok) {
    const errText = await gitlabRes.text().catch(() => 'Unknown error');
    await supabase.from('test_runs').update({
      status: 'aborted',
      description: `GitLab trigger failed (${gitlabRes.status}): ${errText}`,
    }).eq('id', testRun.id);
    return NextResponse.json({ error: `GitLab returned ${gitlabRes.status}`, details: errText }, { status: 502 });
  }

  const gitlabData = await gitlabRes.json() as { id?: number; web_url?: string; status?: string };
  const pipelineUrl = gitlabData.web_url ?? null;

  // Store pipeline URL on the run
  if (pipelineUrl) {
    await supabase.from('test_runs').update({ gitlab_pipeline_url: pipelineUrl }).eq('id', testRun.id);
  }

  return NextResponse.json({
    test_run_id: testRun.id,
    pipeline_url: pipelineUrl,
  });
}
