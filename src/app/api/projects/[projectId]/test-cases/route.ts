import { NextResponse } from 'next/server';
import { withAuth, notFound, serverError } from '@/lib/api/helpers';

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { projectId } = await context.params;
  const { searchParams } = new URL(request.url);
  const includeStatus = searchParams.get('include_status') === 'true';
  const includeSteps = searchParams.get('include_steps') === 'true';
  const runId = searchParams.get('run_id');

  const { data: project, error: projError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single();

  if (projError || !project) return notFound('Project');

  const { data: suites, error: suitesError } = await supabase
    .from('suites')
    .select('id, name, prefix, color_index, position')
    .eq('project_id', projectId)
    .order('position', { ascending: true });

  if (suitesError) return serverError(suitesError.message);

  const { data: testCases, error: tcError } = await supabase
    .from('test_cases')
    .select('*')
    .in('suite_id', (suites ?? []).map((s) => s.id))
    .order('position', { ascending: true });

  if (tcError) return serverError(tcError.message);

  const suiteMap = new Map((suites ?? []).map((s) => [s.id, s]));

  const enriched = (testCases ?? []).map((tc) => {
    const suite = suiteMap.get(tc.suite_id);
    return {
      ...tc,
      suite_name: suite?.name ?? '',
      suite_prefix: suite?.prefix ?? '',
      suite_color_index: suite?.color_index ?? 0,
      suite_position: suite?.position ?? 0,
    };
  });

  enriched.sort((a, b) => {
    if (a.suite_position !== b.suite_position) return a.suite_position - b.suite_position;
    return a.position - b.position;
  });

  if (includeSteps && enriched.length > 0) {
    const caseIds = enriched.map((tc) => tc.id);
    const { data: allSteps } = await supabase
      .from('test_steps')
      .select('id, test_case_id, step_number, description, test_data, expected_result, is_automation_only')
      .in('test_case_id', caseIds)
      .order('step_number', { ascending: true });

    const stepsMap: Record<string, Array<Record<string, unknown>>> = {};
    for (const s of allSteps ?? []) {
      if (!stepsMap[s.test_case_id]) stepsMap[s.test_case_id] = [];
      stepsMap[s.test_case_id].push(s);
    }
    for (const tc of enriched) {
      (tc as Record<string, unknown>).test_steps = stepsMap[tc.id] ?? [];
    }
  }

  if ((includeStatus || runId) && enriched.length > 0) {
    const caseIds = enriched.map((tc) => tc.id);

    let resultsQuery = supabase
      .from('execution_results')
      .select('test_case_id, test_step_id, platform, status, executed_at')
      .in('test_case_id', caseIds)
      .order('executed_at', { ascending: false, nullsFirst: false });

    if (runId) {
      resultsQuery = resultsQuery.eq('test_run_id', runId);
    }

    const { data: results } = await resultsQuery;

    const caseStatusMap: Record<string, Record<string, string>> = {};
    const stepStatusMap: Record<string, Record<string, Record<string, string>>> = {};

    if (results && results.length > 0) {
      for (const r of results) {
        if (!caseStatusMap[r.test_case_id]) caseStatusMap[r.test_case_id] = {};
        if (!caseStatusMap[r.test_case_id][r.platform]) {
          caseStatusMap[r.test_case_id][r.platform] = r.status;
        }
        if (includeSteps && r.test_step_id) {
          const stepKey = `${r.test_case_id}:${r.test_step_id}`;
          if (!stepStatusMap[stepKey]) stepStatusMap[stepKey] = {};
          if (!stepStatusMap[stepKey][r.platform]) {
            stepStatusMap[stepKey] = { ...stepStatusMap[stepKey], [r.platform]: r.status };
          }
        }
      }
    }

    for (const tc of enriched) {
      (tc as Record<string, unknown>).platform_status = caseStatusMap[tc.id] ?? {};
      if (includeSteps) {
        const steps = (tc as Record<string, unknown>).test_steps as Array<Record<string, unknown>> | undefined;
        if (steps) {
          for (const step of steps) {
            const stepKey = `${tc.id}:${step.id}`;
            step.step_status = stepStatusMap[stepKey] ?? {};
          }
        }
      }
    }
  }

  return NextResponse.json(enriched);
}
