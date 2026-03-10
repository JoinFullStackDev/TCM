import { NextResponse } from 'next/server';
import { withAuth, validationError, serverError } from '@/lib/api/helpers';
import { upsertGridPreferencesSchema } from '@/lib/validations/grid-preferences';

export async function GET(request: Request) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');
  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
  }

  const suiteId = searchParams.get('suite_id');

  let query = supabase
    .from('grid_column_preferences')
    .select('*')
    .eq('user_id', user.id)
    .eq('project_id', projectId);

  if (suiteId) {
    query = query.eq('suite_id', suiteId);
  } else {
    query = query.is('suite_id', null);
  }

  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return serverError(error.message);

  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const body = await request.json();
  const parsed = upsertGridPreferencesSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { project_id, suite_id, column_config } = parsed.data;
  const resolvedSuiteId = suite_id ?? null;

  if (resolvedSuiteId) {
    const { data, error } = await supabase
      .from('grid_column_preferences')
      .upsert(
        {
          user_id: user.id,
          project_id,
          suite_id: resolvedSuiteId,
          column_config,
        },
        { onConflict: 'user_id,project_id,suite_id' },
      )
      .select()
      .single();

    if (error) return serverError(error.message);
    return NextResponse.json(data);
  }

  // NULL suite_id: ON CONFLICT doesn't match NULLs, so use manual select+upsert
  const { data: existing } = await supabase
    .from('grid_column_preferences')
    .select('id')
    .eq('user_id', user.id)
    .eq('project_id', project_id)
    .is('suite_id', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('grid_column_preferences')
      .update({ column_config })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) return serverError(error.message);
    return NextResponse.json(data);
  }

  const { data, error } = await supabase
    .from('grid_column_preferences')
    .insert({
      user_id: user.id,
      project_id,
      suite_id: null,
      column_config,
    })
    .select()
    .single();

  if (error) return serverError(error.message);
  return NextResponse.json(data);
}
