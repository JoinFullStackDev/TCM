import { NextResponse } from 'next/server';
import { serverError } from '@/lib/api/helpers';
import { simAuth } from '@/lib/partner-sim/server';

interface RouteContext {
  params: Promise<{ partnerId: string; prescriberId: string }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await simAuth();
  if (!auth.ok) return auth.response;
  const { partnerId, prescriberId } = await context.params;

  const { error } = await auth.db
    .from('partner_sim_prescribers')
    .delete()
    .eq('id', prescriberId)
    .eq('partner_id', partnerId);
  if (error) return serverError(error.message);
  return new NextResponse(null, { status: 204 });
}
