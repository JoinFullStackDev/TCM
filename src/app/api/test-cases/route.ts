import { NextResponse } from 'next/server';
import { withAuth, withAgentAuth, validationError, serverError } from '@/lib/api/helpers';
import { createTestCaseSchema } from '@/lib/validations/test-case';
import { stepSchema } from '@/lib/validations/test-step';
import { TestCaseRepository } from '@/lib/db/test-case-repository';
import { z } from 'zod';

// E2 list filter extensions
const LIST_LIMIT_DEFAULT = 50;
const LIST_LIMIT_MAX = 200;

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

  // E2 — MCP prerequisite: project_id filter + limit clamp
  const projectId = searchParams.get('project_id')?.trim();
  const limitParam = searchParams.get('limit');
  const rawLimit = limitParam ? parseInt(limitParam, 10) : LIST_LIMIT_DEFAULT;
  const clampedLimit = Math.min(isNaN(rawLimit) || rawLimit < 1 ? LIST_LIMIT_DEFAULT : rawLimit, LIST_LIMIT_MAX);
  const limitClamped = limitParam && rawLimit > LIST_LIMIT_MAX;

  // Text search applied in-memory (the supabase client query is constructed in findAll)
  // For search we need to re-query with ilike — fall through to direct query below
  if (search || projectId) {
    // Re-query with search/project_id filter directly
    let q = supabase
      .from('test_cases')
      .select('*, suite:suites!inner(project_id)')
      .is('deleted_at', null)
      .order('position', { ascending: true })
      .limit(clampedLimit);
    if (search) q = q.or(`display_id.ilike.%${search}%,title.ilike.%${search}%`);
    if (suiteId) q = q.eq('suite_id', suiteId);
    // project_id filter via inner join on suites
    if (projectId) q = q.eq('suites.project_id', projectId);
    const { data, error } = await q;
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

  // Apply limit if no search/projectId path was taken
  if (!search && !projectId && clampedLimit < testCases.length) {
    testCases = testCases.slice(0, clampedLimit);
  }

  const total = testCases.length;
  const has_more = limitClamped;

  // If lean projection requested (MCP path), return minimal fields
  const lean = searchParams.get('fields') === 'lean';
  if (lean) {
    return NextResponse.json({
      items: testCases.map((tc) => ({
        display_id: tc.display_id,
        title: tc.title,
        automation_status: tc.automation_status,
        priority: tc.priority,
      })),
      total,
      has_more,
    });
  }

  return NextResponse.json(testCases);
}

// E4 body schema: createTestCaseSchema extended with optional steps[] and dry_run
const createWithStepsSchema = createTestCaseSchema.extend({
  steps: z
    .array(
      stepSchema.omit({ step_number: true }).extend({
        step_number: z.number().int().min(1).optional(),
      }),
    )
    .optional(),
  dry_run: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  // Accept both agent auth (X-Clutch-Key / Bearer JWT) and normal session auth.
  // Try agent auth first so headless agents (Torque via Clutch) can create cases.
  // E4 extension: accepts optional steps[] for atomic insert + dry_run support (OQ-6 Option B).
  const rawBody = await request.json();

  // Detect if this is an MCP call (has steps or dry_run field)
  const isMcpCall = 'steps' in rawBody || 'dry_run' in rawBody;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabase: any;
  let userId: string | null = null;

  if (isMcpCall) {
    // Agent auth path for MCP callers
    const agentAuth = await withAgentAuth();
    if (!agentAuth.ok) return agentAuth.response;
    supabase = agentAuth.supabase;
    // Try to resolve user from Bearer token for attribution (OQ-2)
    const authHeader = request.headers.get('authorization') ?? '';
    if (authHeader.startsWith('Bearer ')) {
      const { data } = await supabase.auth.getUser(authHeader.slice(7));
      userId = data.user?.id ?? null;
    }
  } else {
    // Normal session auth for UI callers
    const auth = await withAuth('write');
    if (!auth.ok) return auth.response;
    supabase = auth.ctx.supabase;
    userId = auth.ctx.user.id;
  }

  // Parse with extended schema (supports steps + dry_run) or basic schema
  const parsed = isMcpCall
    ? createWithStepsSchema.safeParse(rawBody)
    : createTestCaseSchema.extend({ steps: z.never().optional(), dry_run: z.never().optional() }).safeParse(rawBody);

  if (!parsed.success) return validationError(parsed.error.flatten());
  const data = parsed.data as z.infer<typeof createWithStepsSchema>;

  // OQ-6: dry_run support — validate + summarize, no write
  const queryDryRun = new URL(request.url).searchParams.get('dry_run') === 'true';
  const dryRun = data.dry_run || queryDryRun;

  if (dryRun) {
    // Log dry-run attempt
    const correlationId = request.headers.get('x-mcp-correlation-id') ?? null;
    const actorIdentity = request.headers.get('x-clutch-key') ? 'clutch-key' : 'bearer-jwt';
    await supabase.from('mcp_tool_calls').insert({
      correlation_id: correlationId,
      tool: 'create_test_case',
      dry_run: true,
      intent: request.headers.get('x-mcp-intent') ?? 'dry-run-create',
      actor_identity: actorIdentity,
      suite_id: data.suite_id,
      outcome: 'dry_run_returned',
    }).then(() => {});

    const proposedSteps = data.steps
      ? data.steps.map((s, i) => ({ ...s, step_number: i + 1 }))
      : [];

    // Fetch suite prefix for summary (display_id assigned on commit)
    const { data: suite } = await supabase
      .from('suites')
      .select('prefix, name')
      .eq('id', data.suite_id)
      .single();

    const summaryLines = [
      '## Dry-run: create test case',
      '',
      `**Suite:** ${suite?.name ?? data.suite_id} (prefix: ${suite?.prefix ?? '?'})`,
      `**Title:** ${data.title}`,
      `**Priority:** ${data.priority ?? 'null'}`,
      `**Automation status:** ${data.automation_status ?? 'not_automated'}`,
      `**Platform tags:** ${(data.platform_tags ?? []).join(', ') || 'none'}`,
      '',
      '_display_id will be assigned on commit_',
      '',
      `**Steps (${proposedSteps.length}):**`,
      ...proposedSteps.map((s) => `  ${s.step_number}. ${s.description}`),
    ];

    return NextResponse.json({
      dry_run: true,
      would_create: { ...data, steps: proposedSteps },
      summary_markdown: summaryLines.join('\n'),
    });
  }

  // --- Commit path ---

  // Duplicate-name notice: check if a deleted case with the same title exists
  const repo = new TestCaseRepository(supabase);
  const deletedMatches = await repo.findDeletedByTitle(data.title, data.suite_id);
  const duplicateNotice = deletedMatches.length > 0
    ? `A deleted test case named "${data.title}" exists in the trash. You can restore it instead.`
    : null;

  const { data: idResult, error: rpcError } = await supabase
    .rpc('generate_test_case_id', { p_suite_id: data.suite_id })
    .single();

  if (rpcError || !idResult) {
    return serverError(rpcError?.message ?? 'Failed to generate test case ID');
  }

  const { display_id, sequence_number } = idResult as { display_id: string; sequence_number: number };

  // Determine position: append at MAX(position) + 1 for the suite
  const { data: maxPosRow } = await supabase
    .from('test_cases')
    .select('position')
    .eq('suite_id', data.suite_id)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = ((maxPosRow?.position as number | null) ?? 0) + 1;

  const { data: testCase, error } = await supabase
    .from('test_cases')
    .insert({
      suite_id: data.suite_id,
      display_id,
      sequence_number,
      title: data.title,
      description: data.description ?? null,
      precondition: data.precondition ?? null,
      type: data.type,
      automation_status: data.automation_status,
      platform_tags: data.platform_tags,
      priority: data.priority ?? null,
      tags: data.tags,
      position: nextPosition,
      created_by: userId,
      updated_by: userId,
    })
    .select()
    .single();

  if (error) return serverError(error.message);

  // E4 extension: atomically insert steps if provided
  let insertedSteps: unknown[] = [];
  if (data.steps && data.steps.length > 0 && testCase) {
    const stepRows = data.steps.map((s, i) => ({
      test_case_id: testCase.id,
      step_number: i + 1,
      description: s.description,
      test_data: s.test_data ?? null,
      expected_result: s.expected_result ?? null,
      is_automation_only: s.is_automation_only ?? false,
      category: s.category ?? null,
    }));

    const { data: steps, error: stepsErr } = await supabase
      .from('test_steps')
      .insert(stepRows)
      .select()
      .order('step_number', { ascending: true });

    if (stepsErr) {
      // Compensate: delete the case if steps insert fails (maintain atomicity)
      await supabase.from('test_cases').delete().eq('id', testCase.id);
      return serverError(stepsErr.message);
    }
    insertedSteps = steps ?? [];
  }

  // Log MCP commit call
  if (isMcpCall) {
    const correlationId = request.headers.get('x-mcp-correlation-id') ?? null;
    const actorIdentity = request.headers.get('x-clutch-key') ? 'clutch-key' : 'bearer-jwt';
    await supabase.from('mcp_tool_calls').insert({
      correlation_id: correlationId,
      tool: 'create_test_case',
      dry_run: false,
      intent: request.headers.get('x-mcp-intent') ?? 'commit-create',
      actor_identity: actorIdentity,
      resolved_display_id: display_id,
      suite_id: data.suite_id,
      outcome: 'success',
    }).then(() => {});
  }

  return NextResponse.json(
    {
      ...testCase,
      steps: insertedSteps,
      ...(duplicateNotice ? { notice: duplicateNotice } : {}),
    },
    { status: 201 },
  );
}
