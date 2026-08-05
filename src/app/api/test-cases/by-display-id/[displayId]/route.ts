import { NextResponse } from 'next/server';
import { withAgentAuth, notFound, serverError, validationError, resolveAgentWriterId } from '@/lib/api/helpers';
import { updateTestCaseSchema } from '@/lib/validations/test-case';
import { stepSchema } from '@/lib/validations/test-step';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ displayId: string }>;
}

/**
 * Shared helper: resolve a display_id to an active test case UUID.
 * Returns null if not found or deleted.
 */
async function resolveDisplayId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  displayId: string,
): Promise<{ id: string; automation_status: string } | null> {
  const { data, error } = await supabase
    .from('test_cases')
    .select('id, automation_status')
    .eq('display_id', displayId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

/**
 * GET /api/test-cases/by-display-id/[displayId]
 *
 * E3 — MCP prerequisite: resolve display_id → full case with steps.
 * Auth: withAgentAuth (X-Clutch-Key or Bearer Supabase JWT or session cookie).
 */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await withAgentAuth();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { displayId } = await context.params;
  const decodedDisplayId = decodeURIComponent(displayId);

  const resolved = await resolveDisplayId(supabase, decodedDisplayId);
  if (!resolved) return notFound('Test case');

  const { data: testCase, error } = await supabase
    .from('test_cases')
    .select(`
      *,
      suite:suites(id, name, prefix, project_id),
      test_steps(id, step_number, description, test_data, expected_result, is_automation_only, category)
    `)
    .eq('id', resolved.id)
    .is('deleted_at', null)
    .single();

  if (error || !testCase) return notFound('Test case');

  // Sort steps by step_number
  const sortedSteps = ((testCase.test_steps ?? []) as Array<{ step_number: number }>)
    .sort((a, b) => a.step_number - b.step_number);

  return NextResponse.json({
    display_id: testCase.display_id,
    suite: testCase.suite,
    title: testCase.title,
    precondition: testCase.precondition,
    description: testCase.description,
    priority: testCase.priority,
    automation_status: testCase.automation_status,
    type: testCase.type,
    platform_tags: testCase.platform_tags,
    tags: testCase.tags,
    steps: sortedSteps,
    created_at: testCase.created_at,
    updated_at: testCase.updated_at,
  });
}

// MCP v1 update schema — constrained enum surface per PRD §7 / OQ-5
const mcpUpdateBodySchema = updateTestCaseSchema
  .omit({ display_id: true, suite_id: true })
  .extend({
    // v1: priority only low/medium/high/null (critical deferred)
    priority: z.enum(['low', 'medium', 'high']).nullable().optional(),
    // v1: type not exposed; steps full-replace if provided
    steps: z
      .array(
        stepSchema.omit({ step_number: true }).extend({
          // step_number will be assigned by array order (1-based)
          step_number: z.number().int().min(1).optional(),
        }),
      )
      .optional(),
    dry_run: z.boolean().optional().default(false),
  });

/**
 * PATCH /api/test-cases/by-display-id/[displayId]
 *
 * E5 — MCP prerequisite: partial update by display_id with optional steps full-replace.
 * Supports ?dry_run=true query param (OQ-6 Option B).
 * Auth: withAgentAuth.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await withAgentAuth();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { displayId } = await context.params;
  const decodedDisplayId = decodeURIComponent(displayId);

  // Resolve updated_by attribution (OQ-2): Bearer user -> MCP X-Agent-User-Id -> default.
  const userId: string | null = await resolveAgentWriterId(request, supabase);

  // OQ-6: also support ?dry_run=true query param
  const { searchParams } = new URL(request.url);
  const queryDryRun = searchParams.get('dry_run') === 'true';

  const body = await request.json();
  const parsed = mcpUpdateBodySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const dryRun = parsed.data.dry_run || queryDryRun;

  // Resolve display_id → UUID (active rows only)
  const resolved = await resolveDisplayId(supabase, decodedDisplayId);
  if (!resolved) return notFound('Test case');

  // IN_CICD_LOCKED: display_id changes not accepted (tool docs say don't pass it,
  // but guard anyway — any attempt implies rename intent)
  // For in_cicd cases, reject any attempted display_id change (though schema omits it,
  // also reject if automation_status is being changed away from in_cicd illegally).
  // The real lock is: don't accept display_id changes — enforced by schema omit above.

  // Fetch existing case + steps for diff / before-state
  const { data: existing, error: fetchErr } = await supabase
    .from('test_cases')
    .select(`
      *,
      suite:suites(id, name, prefix, project_id),
      test_steps(id, step_number, description, test_data, expected_result, is_automation_only, category)
    `)
    .eq('id', resolved.id)
    .is('deleted_at', null)
    .single();

  if (fetchErr || !existing) return notFound('Test case');

  const existingSteps = ((existing.test_steps ?? []) as Array<{ step_number: number }>)
    .sort((a, b) => a.step_number - b.step_number);

  // Compute field diff for dry-run response
  const { steps: newSteps, dry_run: _dryRun, ...caseUpdates } = parsed.data;

  // Log to mcp_tool_calls table (instrumentation — Appendix C)
  const correlationId = request.headers.get('x-mcp-correlation-id') ?? null;
  const intent = request.headers.get('x-mcp-intent') ?? (dryRun ? 'dry-run-update' : 'commit-update');
  const actorIdentity = request.headers.get('x-clutch-key')
    ? 'clutch-key'
    : request.headers.get('authorization')
      ? 'bearer-jwt'
      : 'session';

  await supabase.from('mcp_tool_calls').insert({
    correlation_id: correlationId,
    tool: 'update_test_case',
    dry_run: dryRun,
    intent,
    actor_identity: actorIdentity,
    resolved_display_id: decodedDisplayId,
    suite_id: existing.suite_id,
    outcome: 'pending',
  }).then(() => {}); // fire-and-forget, don't block response

  if (dryRun) {
    // Compute before/after diff for case fields
    const fieldDiff: Record<string, { before: unknown; after: unknown }> = {};
    for (const [key, value] of Object.entries(caseUpdates)) {
      const before = (existing as Record<string, unknown>)[key];
      if (JSON.stringify(before) !== JSON.stringify(value)) {
        fieldDiff[key] = { before, after: value };
      }
    }

    // Compute proposed steps (assign step_number by order)
    const proposedSteps = newSteps
      ? newSteps.map((s, i) => ({ ...s, step_number: i + 1 }))
      : null;

    // Build human-readable markdown summary
    const summaryLines: string[] = [
      `## Dry-run: update \`${decodedDisplayId}\``,
      '',
      '### Field changes',
    ];
    if (Object.keys(fieldDiff).length === 0) {
      summaryLines.push('_No field changes_');
    } else {
      for (const [field, { before, after }] of Object.entries(fieldDiff)) {
        summaryLines.push(`- **${field}**: \`${JSON.stringify(before)}\` → \`${JSON.stringify(after)}\``);
      }
    }

    if (proposedSteps !== null) {
      summaryLines.push('', '### Steps (full replace)');
      summaryLines.push('**Before:**');
      for (const s of existingSteps as Array<Record<string, unknown>>) {
        summaryLines.push(`  ${s.step_number}. ${s.description}`);
      }
      summaryLines.push('**After:**');
      for (const s of proposedSteps) {
        summaryLines.push(`  ${s.step_number}. ${s.description}`);
      }
    }

    // Update mcp_tool_calls outcome
    await supabase.from('mcp_tool_calls').update({ outcome: 'dry_run_returned' })
      .eq('correlation_id', correlationId ?? '')
      .then(() => {});

    return NextResponse.json({
      dry_run: true,
      display_id: decodedDisplayId,
      diff: fieldDiff,
      steps_before: existingSteps,
      steps_after: proposedSteps,
      summary_markdown: summaryLines.join('\n'),
    });
  }

  // Commit path — apply partial update
  const updatePayload: Record<string, unknown> = { ...caseUpdates };
  // Set updated_by for attribution (OQ-2)
  if (userId) updatePayload.updated_by = userId;

  if (Object.keys(updatePayload).length === 0 && !newSteps) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  let updatedCase: Record<string, unknown> | null = null;

  if (Object.keys(updatePayload).length > 0) {
    const { data, error: updateErr } = await supabase
      .from('test_cases')
      .update(updatePayload)
      .eq('id', resolved.id)
      .is('deleted_at', null)
      .select()
      .single();

    if (updateErr || !data) return serverError(updateErr?.message ?? 'Failed to update test case');
    updatedCase = data as Record<string, unknown>;
  } else {
    updatedCase = existing as Record<string, unknown>;
  }

  // Steps full-replace if provided
  if (newSteps !== undefined) {
    const { error: deleteErr } = await supabase
      .from('test_steps')
      .delete()
      .eq('test_case_id', resolved.id);

    if (deleteErr) return serverError(deleteErr.message);

    if (newSteps.length > 0) {
      const stepRows = newSteps.map((s, i) => ({
        test_case_id: resolved.id,
        step_number: i + 1,
        description: s.description,
        test_data: s.test_data ?? null,
        expected_result: s.expected_result ?? null,
        is_automation_only: s.is_automation_only ?? false,
        category: s.category ?? null,
      }));

      const { error: insertErr } = await supabase
        .from('test_steps')
        .insert(stepRows);

      if (insertErr) return serverError(insertErr.message);
    }
  }

  // Fetch updated case with full relations for response
  const { data: finalCase, error: finalErr } = await supabase
    .from('test_cases')
    .select(`
      *,
      suite:suites(id, name, prefix, project_id),
      test_steps(id, step_number, description, test_data, expected_result, is_automation_only, category)
    `)
    .eq('id', resolved.id)
    .is('deleted_at', null)
    .single();

  if (finalErr || !finalCase) return serverError('Failed to fetch updated test case');

  const sortedFinalSteps = ((finalCase.test_steps ?? []) as Array<{ step_number: number }>)
    .sort((a, b) => a.step_number - b.step_number);

  // Update mcp_tool_calls outcome
  await supabase.from('mcp_tool_calls').update({ outcome: 'success' })
    .eq('correlation_id', correlationId ?? '')
    .then(() => {});

  return NextResponse.json({
    display_id: finalCase.display_id,
    suite: finalCase.suite,
    title: finalCase.title,
    precondition: finalCase.precondition,
    description: finalCase.description,
    priority: finalCase.priority,
    automation_status: finalCase.automation_status,
    type: finalCase.type,
    platform_tags: finalCase.platform_tags,
    tags: finalCase.tags,
    steps: sortedFinalSteps,
    created_at: finalCase.created_at,
    updated_at: finalCase.updated_at,
  });
}


