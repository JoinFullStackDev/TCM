import { NextResponse } from 'next/server';
import { withAuth, validationError, notFound, serverError } from '@/lib/api/helpers';
import { replaceStepsSchema } from '@/lib/validations/test-step';

interface RouteContext {
  params: Promise<{ testCaseId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { testCaseId } = await context.params;

  const { data: steps, error } = await supabase
    .from('test_steps')
    .select('*')
    .eq('test_case_id', testCaseId)
    .order('step_number', { ascending: true });

  if (error) return serverError(error.message);

  return NextResponse.json(steps ?? []);
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { testCaseId } = await context.params;

  const { data: tc } = await supabase
    .from('test_cases')
    .select('id')
    .eq('id', testCaseId)
    .single();

  if (!tc) return notFound('Test case');

  const body = await request.json();
  const parsed = replaceStepsSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { error: deleteError } = await supabase
    .from('test_steps')
    .delete()
    .eq('test_case_id', testCaseId);

  if (deleteError) return serverError(deleteError.message);

  if (parsed.data.steps.length === 0) {
    return NextResponse.json([]);
  }

  const rows = parsed.data.steps.map((step) => ({
    test_case_id: testCaseId,
    step_number: step.step_number,
    description: step.description,
    test_data: step.test_data ?? null,
    expected_result: step.expected_result ?? null,
    is_automation_only: step.is_automation_only,
    category: step.category ?? null,
  }));

  const { data: steps, error: insertError } = await supabase
    .from('test_steps')
    .insert(rows)
    .select()
    .order('step_number', { ascending: true });

  if (insertError) return serverError(insertError.message);

  return NextResponse.json(steps ?? []);
}
