import { NextResponse } from 'next/server';
import { withAuth, notFound, serverError } from '@/lib/api/helpers';

interface RouteContext {
  params: Promise<{ importId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { importId } = await context.params;

  const { data: importRow, error } = await supabase
    .from('csv_imports')
    .select('*')
    .eq('id', importId)
    .single();

  if (error || !importRow) return notFound('Import');

  const { data: errors } = await supabase
    .from('csv_import_errors')
    .select('*')
    .eq('import_id', importId)
    .order('row_number');

  return NextResponse.json({ ...importRow, errors: errors ?? [] });
}
