import { NextResponse } from 'next/server';
import { withAuth, validationError, serverError } from '@/lib/api/helpers';
import { createAnnotationSchema } from '@/lib/validations/execution-result';

export async function GET(request: Request) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { searchParams } = new URL(request.url);
  const executionResultId = searchParams.get('execution_result_id');

  if (!executionResultId) {
    return NextResponse.json({ error: 'execution_result_id is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('annotations')
    .select('*, attachments(*)')
    .eq('execution_result_id', executionResultId)
    .order('created_at', { ascending: true });

  if (error) return serverError(error.message);

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const body = await request.json();
  const parsed = createAnnotationSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { data: annotation, error } = await supabase
    .from('annotations')
    .insert({
      execution_result_id: parsed.data.execution_result_id,
      comment: parsed.data.comment ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(annotation, { status: 201 });
}
