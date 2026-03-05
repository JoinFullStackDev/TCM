import { NextResponse } from 'next/server';
import { withAuth, serverError } from '@/lib/api/helpers';

interface RouteContext {
  params: Promise<{ testCaseId: string; bugLinkId: string }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { bugLinkId } = await context.params;

  const { error } = await supabase
    .from('bug_links')
    .delete()
    .eq('id', bugLinkId);

  if (error) return serverError(error.message);

  return NextResponse.json({ success: true });
}
