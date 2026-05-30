import { NextResponse } from 'next/server';
import { withDualAuth, notFound, serverError } from '@/lib/api/helpers';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withDualAuth(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { id } = await params;

  const { data, error } = await supabase
    .from('agent_runs')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return serverError(error.message);
  if (!data) return notFound('Run');
  return NextResponse.json(data);
}
