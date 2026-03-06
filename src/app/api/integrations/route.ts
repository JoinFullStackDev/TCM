import { NextRequest, NextResponse } from 'next/server';
import { withAuth, validationError, serverError } from '@/lib/api/helpers';
import { createIntegrationSchema } from '@/lib/validations/integration';

export async function GET(request: NextRequest) {
  const auth = await withAuth('manage_integrations');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const projectId = request.nextUrl.searchParams.get('project_id');

  let query = supabase
    .from('integrations')
    .select('*, creator:created_by(full_name, email)')
    .order('created_at', { ascending: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;

  if (error) return serverError(error.message);

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const auth = await withAuth('manage_integrations');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const body = await request.json();
  const parsed = createIntegrationSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { data: existing } = await supabase
    .from('integrations')
    .select('id')
    .eq('project_id', parsed.data.project_id)
    .eq('type', parsed.data.type)
    .is('suite_id', parsed.data.suite_id ?? null)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: 'An integration of this type already exists for this scope' },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from('integrations')
    .insert({
      project_id: parsed.data.project_id,
      suite_id: parsed.data.suite_id ?? null,
      type: parsed.data.type,
      config: parsed.data.config,
      is_active: parsed.data.is_active,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data, { status: 201 });
}
