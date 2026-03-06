import { NextResponse } from 'next/server';
import { withAuth, validationError, serverError } from '@/lib/api/helpers';
import { createTestCaseSchema } from '@/lib/validations/test-case';

export async function GET(request: Request) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { searchParams } = new URL(request.url);
  const suiteId = searchParams.get('suite_id');
  const includeStatus = searchParams.get('include_status') === 'true';
  const includeSteps = searchParams.get('include_steps') === 'true';
  const runId = searchParams.get('run_id');

  let query = supabase
    .from('test_cases')
    .select('*')
    .order('position', { ascending: true });

  if (suiteId) {
    query = query.eq('suite_id', suiteId);
  }

  const { data, error } = await query;
  if (error) return serverError(error.message);

  const testCases = data ?? [];

  if (includeSteps && testCases.length > 0) {
    const caseIds = testCases.map((tc) => tc.id);
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
    for (const tc of testCases) {
      (tc as Record<string, unknown>).test_steps = stepsMap[tc.id] ?? [];
    }
  }

  if ((includeStatus || runId) && testCases.length > 0) {
    const caseIds = testCases.map((tc) => tc.id);

    let resultsQuery = supabase
      .from('execution_results')
      .select('test_case_id, test_step_id, platform, status, executed_at')
      .in('test_case_id', caseIds)
      .order('executed_at', { ascending: false, nullsFirst: false });

    if (runId) {
      resultsQuery = resultsQuery.eq('test_run_id', runId);
    }

    const { data: results } = await resultsQuery;

    const statusPriority: Record<string, number> = { fail: 4, blocked: 3, skip: 2, not_run: 1, pass: 0 };
    const worstStatus = (statuses: string[]): string => {
      let worst = 'pass';
      let worstP = 0;
      for (const s of statuses) {
        const p = statusPriority[s] ?? 0;
        if (p > worstP) { worst = s; worstP = p; }
      }
      return worst;
    };

    const caseplatformStatuses: Record<string, Record<string, string[]>> = {};
    const stepStatusMap: Record<string, Record<string, string>> = {};

    if (results && results.length > 0) {
      for (const r of results) {
        if (!caseplatformStatuses[r.test_case_id]) caseplatformStatuses[r.test_case_id] = {};
        if (!caseplatformStatuses[r.test_case_id][r.platform]) caseplatformStatuses[r.test_case_id][r.platform] = [];
        caseplatformStatuses[r.test_case_id][r.platform].push(r.status);

        if (includeSteps && r.test_step_id) {
          const stepKey = `${r.test_case_id}:${r.test_step_id}`;
          if (!stepStatusMap[stepKey]) stepStatusMap[stepKey] = {};
          if (!stepStatusMap[stepKey][r.platform]) {
            stepStatusMap[stepKey] = { ...stepStatusMap[stepKey], [r.platform]: r.status };
          }
        }
      }
    }

    const stepCounts: Record<string, number> = {};
    if (includeSteps) {
      for (const tc of testCases) {
        const steps = (tc as Record<string, unknown>).test_steps as Array<Record<string, unknown>> | undefined;
        stepCounts[tc.id] = steps?.length ?? 0;
      }
    }

    for (const tc of testCases) {
      const platformStatuses = caseplatformStatuses[tc.id] ?? {};
      const aggregated: Record<string, string> = {};
      const totalSteps = stepCounts[tc.id] ?? 0;

      for (const [platform, statuses] of Object.entries(platformStatuses)) {
        if (totalSteps > 0 && statuses.length < totalSteps) {
          statuses.push('not_run');
        }
        aggregated[platform] = worstStatus(statuses);
      }
      (tc as Record<string, unknown>).platform_status = aggregated;

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

  return NextResponse.json(testCases);
}

export async function POST(request: Request) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const body = await request.json();
  const parsed = createTestCaseSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { data: idResult, error: rpcError } = await supabase.rpc(
    'generate_test_case_id',
    { p_suite_id: parsed.data.suite_id },
  );

  if (rpcError || !idResult) {
    return serverError(rpcError?.message ?? 'Failed to generate test case ID');
  }

  const { display_id, sequence_number } = idResult as { display_id: string; sequence_number: number };

  const { data: testCase, error } = await supabase
    .from('test_cases')
    .insert({
      suite_id: parsed.data.suite_id,
      display_id,
      sequence_number,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      precondition: parsed.data.precondition ?? null,
      type: parsed.data.type,
      automation_status: parsed.data.automation_status,
      platform_tags: parsed.data.platform_tags,
      priority: parsed.data.priority ?? null,
      tags: parsed.data.tags,
      position: sequence_number,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(testCase, { status: 201 });
}
