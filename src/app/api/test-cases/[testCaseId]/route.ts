import { NextResponse } from 'next/server';
import { withAuth, validationError, notFound, serverError } from '@/lib/api/helpers';
import { updateTestCaseSchema } from '@/lib/validations/test-case';

interface RouteContext {
  params: Promise<{ testCaseId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { testCaseId } = await context.params;

  const { data: testCase, error } = await supabase
    .from('test_cases')
    .select(`
      *,
      test_steps(*, id, step_number, description, test_data, expected_result, is_automation_only),
      bug_links(*, id, url, title, provider, external_id, external_status),
      test_case_versions(id, version_number, changed_by, change_summary, created_at, changer:changed_by(full_name))
    `)
    .eq('id', testCaseId)
    .single();

  if (error || !testCase) return notFound('Test case');

  const sortedSteps = (testCase.test_steps ?? []).sort(
    (a: { step_number: number }, b: { step_number: number }) => a.step_number - b.step_number,
  );
  const sortedVersions = (testCase.test_case_versions ?? []).sort(
    (a: { version_number: number }, b: { version_number: number }) => b.version_number - a.version_number,
  );

  return NextResponse.json({
    ...testCase,
    test_steps: sortedSteps,
    test_case_versions: sortedVersions,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;
  const { testCaseId } = await context.params;

  const body = await request.json();
  const parsed = updateTestCaseSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { data: testCase, error } = await supabase
    .from('test_cases')
    .update({ ...parsed.data, updated_by: user.id })
    .eq('id', testCaseId)
    .select()
    .single();

  if (error || !testCase) return notFound('Test case');

  return NextResponse.json(testCase);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await withAuth('delete');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { testCaseId } = await context.params;

  const { error } = await supabase
    .from('test_cases')
    .delete()
    .eq('id', testCaseId);

  if (error) return serverError(error.message);

  return NextResponse.json({ success: true });
}
