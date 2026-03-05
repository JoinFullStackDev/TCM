import { NextResponse } from 'next/server';
import { withAuth, validationError, serverError } from '@/lib/api/helpers';
import { createProjectSchema } from '@/lib/validations/project';

export async function GET() {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { data: projects, error } = await supabase
    .from('projects')
    .select('*, suites(count)')
    .order('created_at', { ascending: false });

  if (error) return serverError(error.message);

  const enriched = await Promise.all(
    (projects ?? []).map(async (p) => {
      const { count } = await supabase
        .from('test_cases')
        .select('*', { count: 'exact', head: true })
        .in(
          'suite_id',
          (
            await supabase
              .from('suites')
              .select('id')
              .eq('project_id', p.id)
          ).data?.map((s: { id: string }) => s.id) ?? [],
        );

      return {
        ...p,
        suite_count: (p.suites as unknown as { count: number }[])?.[0]?.count ?? 0,
        test_case_count: count ?? 0,
      };
    }),
  );

  return NextResponse.json(enriched);
}

export async function POST(request: Request) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const body = await request.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(project, { status: 201 });
}
