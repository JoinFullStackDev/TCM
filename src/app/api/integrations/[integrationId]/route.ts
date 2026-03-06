import { NextResponse } from 'next/server';
import { withAuth, validationError, notFound, serverError } from '@/lib/api/helpers';
import { updateIntegrationSchema } from '@/lib/validations/integration';

interface RouteContext {
  params: Promise<{ integrationId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await withAuth('manage_integrations');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { integrationId } = await context.params;

  const { data, error } = await supabase
    .from('integrations')
    .select('*, creator:created_by(full_name, email)')
    .eq('id', integrationId)
    .single();

  if (error || !data) return notFound('Integration');

  return NextResponse.json(data);
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await withAuth('manage_integrations');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { integrationId } = await context.params;

  const body = await request.json();
  const parsed = updateIntegrationSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { data: current, error: fetchError } = await supabase
    .from('integrations')
    .select('config')
    .eq('id', integrationId)
    .single();

  if (fetchError || !current) return notFound('Integration');

  const updates: Record<string, unknown> = {};
  if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active;
  if (parsed.data.suite_id !== undefined) updates.suite_id = parsed.data.suite_id;
  if (parsed.data.config) {
    updates.config = { ...(current.config as Record<string, unknown>), ...parsed.data.config };
  }

  const { data, error } = await supabase
    .from('integrations')
    .update(updates)
    .eq('id', integrationId)
    .select()
    .single();

  if (error || !data) return serverError(error?.message ?? 'Update failed');

  return NextResponse.json(data);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await withAuth('manage_integrations');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { integrationId } = await context.params;

  const { error } = await supabase
    .from('integrations')
    .delete()
    .eq('id', integrationId);

  if (error) return serverError(error.message);

  return NextResponse.json({ success: true });
}
