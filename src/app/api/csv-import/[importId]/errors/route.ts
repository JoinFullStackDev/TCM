import { NextResponse } from 'next/server';
import { withAuth, serverError } from '@/lib/api/helpers';

interface RouteContext {
  params: Promise<{ importId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { importId } = await context.params;

  const { data, error } = await supabase
    .from('csv_import_errors')
    .select('*')
    .eq('import_id', importId)
    .order('row_number');

  if (error) return serverError(error.message);

  return NextResponse.json(data ?? []);
}
