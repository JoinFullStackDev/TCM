import { NextResponse } from 'next/server';
import { withAuth, validationError, serverError } from '@/lib/api/helpers';
import { createTestCaseSchema } from '@/lib/validations/test-case';
import { TestCaseRepository } from '@/lib/db/test-case-repository';

export async function GET(request: Request) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase, role } = auth.ctx;

  const { searchParams } = new URL(request.url);
  const suiteId = searchParams.get('suite_id');
  const includeStatus = searchParams.get('include_status') === 'true';
  const includeSteps = searchParams.get('include_steps') === 'true';
  const runId = searchParams.get('run_id');
  const deleted = searchParams.get('deleted') === 'true';
  const search = searchParams.get('search')?.trim();

  const repo = new TestCaseRepository(supabase);

  // Trash view — Editor+ only (403 for Viewers)
  if (deleted) {
    if (role === 'viewer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const filters: Record<string, unknown> = {};
    if (suiteId) filters.suite_id = suiteId;
    const testCases = await repo.findDeleted(filters); // TRASH_SCOPE
    return NextResponse.json(testCases);
  }

  // Normal active-cases path
  const filters: Record<string, unknown> = {};
  if (suiteId) filters.suite_id = suiteId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testCases: any[] = [];
  try {
    testCases = await repo.findAll(filters);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('deleted_at') || msg.includes('42703')) {
      // Migration 00013 not applied — fall back to a direct query without deleted_at
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let fallbackQuery = (supabase as any)
        .from('test_cases')
        .select('*, suite:suites(project_id)')
        .order('position', { ascending: true });
      if (filters.suite_id) fallbackQuery = fallbackQuery.eq('suite_id', filters.suite_id as string);
      const { data: fbData, error: fbErr } = await fallbackQuery;
      if (fbErr) return serverError(fbErr.message);
      testCases = fbData ?? [];
    } else {
      return serverError(msg);
    }
  }

  // Text search applied in-memory (the supabase client query is constructed in findAll)
  // For search we need to re-query with ilike — fall through to direct query below
  if (search) {
    // Re-query with search filter directly (repository doesn't support ilike yet)
    const { data, error } = await supabase
      .from('test_cases')
      .select('*, suite:suites(project_id)')
      .is('deleted_at', null)
      .or(`display_id.ilike.%${search}%,title.ilike.%${search}%`)
      .order('position', { ascending: true });
    if (error) return serverError(error.message);
    testCases = data ?? [];
  }

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
      stepsMap[s.test_case_id].push(s as Record<string, unknown>);
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

  // Duplicate-name notice: check if a deleted case with the same title exists
  const repo = new TestCaseRepository(supabase);
  const deletedMatches = await repo.findDeletedByTitle(parsed.data.title, parsed.data.suite_id);
  const duplicateNotice = deletedMatches.length > 0
    ? `A deleted test case named "${parsed.data.title}" exists in the trash. You can restore it instead.`
    : null;

  const { data: idResult, error: rpcError } = await supabase
    .rpc('generate_test_case_id', { p_suite_id: parsed.data.suite_id })
    .single();

  if (rpcError || !idResult) {
    return serverError(rpcError?.message ?? 'Failed to generate test case ID');
  }

  const { display_id, sequence_number } = idResult as { display_id: string; sequence_number: number };

  // Determine position: append at MAX(position) + 1 for the suite
  const { data: maxPosRow } = await supabase
    .from('test_cases')
    .select('position')
    .eq('suite_id', parsed.data.suite_id)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = ((maxPosRow?.position as number | null) ?? 0) + 1;

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
      position: nextPosition,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(
    { ...testCase, ...(duplicateNotice ? { notice: duplicateNotice } : {}) },
    { status: 201 },
  );
}
