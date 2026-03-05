import { NextResponse } from 'next/server';
import { withAuth, validationError, serverError } from '@/lib/api/helpers';
import { reorderSuitesSchema } from '@/lib/validations/suite';

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { projectId } = await context.params;

  const body = await request.json();
  const parsed = reorderSuitesSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const updates = parsed.data.items.map(({ id, position }) =>
    supabase
      .from('suites')
      .update({ position })
      .eq('id', id)
      .eq('project_id', projectId),
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return serverError(failed.error.message);

  return NextResponse.json({ success: true });
}
