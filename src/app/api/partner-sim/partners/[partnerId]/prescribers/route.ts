import { NextResponse } from 'next/server';
import { validationError, serverError } from '@/lib/api/helpers';
import { prescriberSchema } from '@/lib/validations/partner-sim';
import { simAuth } from '@/lib/partner-sim/server';

interface RouteContext {
  params: Promise<{ partnerId: string }>;
}

const COLUMNS = 'id, partner_id, npi, first_name, last_name, license_state, license_number, note, last_used_at, created_at';

export async function GET(_request: Request, context: RouteContext) {
  const auth = await simAuth();
  if (!auth.ok) return auth.response;
  const { partnerId } = await context.params;

  const { data, error } = await auth.db
    .from('partner_sim_prescribers')
    .select(COLUMNS)
    .eq('partner_id', partnerId)
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) return serverError(error.message);
  return NextResponse.json(data ?? []);
}

/** Saves (or updates, by NPI) a prescriber for this partner. */
export async function POST(request: Request, context: RouteContext) {
  const auth = await simAuth();
  if (!auth.ok) return auth.response;
  const { partnerId } = await context.params;

  const parsed = prescriberSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { data, error } = await auth.db
    .from('partner_sim_prescribers')
    .upsert({ partner_id: partnerId, ...parsed.data }, { onConflict: 'partner_id,npi' })
    .select(COLUMNS)
    .single();
  if (error) return serverError(error.message);
  return NextResponse.json(data, { status: 201 });
}
