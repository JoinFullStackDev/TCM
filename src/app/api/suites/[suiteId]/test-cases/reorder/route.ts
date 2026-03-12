import { NextResponse } from 'next/server';
import { withAuth, validationError, serverError } from '@/lib/api/helpers';
import { reorderTestCasesSchema } from '@/lib/validations/test-case';

interface RouteContext {
  params: Promise<{ suiteId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { suiteId } = await context.params;

  const body = await request.json();
  const parsed = reorderTestCasesSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const updates = parsed.data.items.map(({ id, position }) =>
    supabase
      .from('test_cases')
      .update({ position })
      .eq('id', id)
      .eq('suite_id', suiteId),
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return serverError(failed.error.message);

  return NextResponse.json({ success: true });
}
