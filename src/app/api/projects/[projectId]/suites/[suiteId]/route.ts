import { NextResponse } from 'next/server';
import { withAuth, validationError, notFound, serverError, conflict } from '@/lib/api/helpers';
import { createServiceClient } from '@/lib/supabase/server';
import { updateSuiteSchema } from '@/lib/validations/suite';

interface RouteContext {
  params: Promise<{ projectId: string; suiteId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { suiteId } = await context.params;

  const { data: suite, error } = await supabase
    .from('suites')
    .select('*')
    .eq('id', suiteId)
    .single();

  if (error || !suite) return notFound('Suite');

  return NextResponse.json(suite);
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { projectId, suiteId } = await context.params;

  const body = await request.json();
  const parsed = updateSuiteSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  if (parsed.data.prefix) {
    const { data: existing } = await supabase
      .from('suites')
      .select('id')
      .eq('project_id', projectId)
      .eq('prefix', parsed.data.prefix)
      .neq('id', suiteId)
      .maybeSingle();

    if (existing) return conflict(`A suite with prefix "${parsed.data.prefix}" already exists`);
  }

  let oldPrefix: string | null = null;
  if (parsed.data.prefix) {
    const { data: currentSuite } = await supabase
      .from('suites')
      .select('prefix')
      .eq('id', suiteId)
      .single();
    oldPrefix = currentSuite?.prefix ?? null;
  }

  const { data: suite, error } = await supabase
    .from('suites')
    .update(parsed.data)
    .eq('id', suiteId)
    .select()
    .single();

  if (error || !suite) return notFound('Suite');

  if (parsed.data.prefix && oldPrefix && oldPrefix !== parsed.data.prefix) {
    const serviceClient = await createServiceClient();
    const { data: cases } = await serviceClient
      .from('test_cases')
      .select('id, sequence_number')
      .eq('suite_id', suiteId);

    if (cases?.length) {
      await Promise.all(
        cases.map((tc) =>
          serviceClient
            .from('test_cases')
            .update({
              display_id: `${parsed.data.prefix}-${tc.sequence_number}`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', tc.id)
        )
      );
    }
  }

  return NextResponse.json(suite);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await withAuth('delete');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { suiteId } = await context.params;

  const { error } = await supabase
    .from('suites')
    .delete()
    .eq('id', suiteId);

  if (error) return serverError(error.message);

  return NextResponse.json({ success: true });
}
