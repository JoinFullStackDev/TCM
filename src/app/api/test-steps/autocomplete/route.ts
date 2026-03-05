import { NextResponse } from 'next/server';
import { withAuth, serverError } from '@/lib/api/helpers';

export async function GET(request: Request) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const projectId = searchParams.get('project_id');

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  let dbQuery = supabase
    .from('test_steps')
    .select('description, test_data, expected_result, test_case_id')
    .ilike('description', `%${query}%`)
    .limit(10);

  if (projectId) {
    const { data: suiteIds } = await supabase
      .from('suites')
      .select('id')
      .eq('project_id', projectId);

    if (suiteIds && suiteIds.length > 0) {
      const { data: caseIds } = await supabase
        .from('test_cases')
        .select('id')
        .in('suite_id', suiteIds.map((s) => s.id));

      if (caseIds && caseIds.length > 0) {
        dbQuery = dbQuery.in('test_case_id', caseIds.map((c) => c.id));
      }
    }
  }

  const { data, error } = await dbQuery;
  if (error) return serverError(error.message);

  const unique = new Map<string, typeof data[0]>();
  for (const step of data ?? []) {
    if (!unique.has(step.description)) {
      unique.set(step.description, step);
    }
  }

  return NextResponse.json(Array.from(unique.values()));
}
