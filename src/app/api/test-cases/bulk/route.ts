import { NextResponse } from 'next/server';
import { withAuth, validationError, serverError } from '@/lib/api/helpers';
import { bulkUpdateSchema } from '@/lib/validations/test-case';

export async function PATCH(request: Request) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const body = await request.json();
  const parsed = bulkUpdateSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { ids, updates } = parsed.data;

  const cleanUpdates: Record<string, unknown> = { updated_by: user.id };
  if (updates.automation_status !== undefined) cleanUpdates.automation_status = updates.automation_status;
  if (updates.platform_tags !== undefined) cleanUpdates.platform_tags = updates.platform_tags;
  if (updates.priority !== undefined) cleanUpdates.priority = updates.priority;
  if (updates.type !== undefined) cleanUpdates.type = updates.type;

  const { data, error } = await supabase
    .from('test_cases')
    .update(cleanUpdates)
    .in('id', ids)
    .select();

  if (error) return serverError(error.message);

  return NextResponse.json({ updated: data?.length ?? 0 });
}
