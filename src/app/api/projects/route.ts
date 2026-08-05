import { NextResponse } from 'next/server';
import { withAuth, withAgentAuth, validationError, serverError } from '@/lib/api/helpers';
import { createProjectSchema } from '@/lib/validations/project';
import type { SupabaseClient } from '@supabase/supabase-js';

const LIST_LIMIT_DEFAULT = 50;
const LIST_LIMIT_MAX = 200;

export async function GET(request: Request) {
  // Dual auth: agents (X-Clutch-Key or Bearer JWT) authenticate via withAgentAuth so the MCP
  // list_projects tool can reach this route; browser/session callers keep withAuth('read').
  // Mirrors the /api/test-cases and /api/projects/{id}/suites routes (PR #105 pattern).
  const isAgentCall =
    request.headers.get('x-clutch-key') !== null ||
    (request.headers.get('authorization') ?? '').startsWith('Bearer ');

  let supabase: SupabaseClient;
  if (isAgentCall) {
    const agentAuth = await withAgentAuth();
    if (!agentAuth.ok) return agentAuth.response;
    supabase = agentAuth.supabase;
  } else {
    const auth = await withAuth('read');
    if (!auth.ok) return auth.response;
    supabase = auth.ctx.supabase;
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim();
  const lean = searchParams.get('fields') === 'lean';

  // Lean projection (MCP list_projects): id + name only, no per-project count N+1 queries.
  // Returns an { items, total, has_more } envelope with case-insensitive name search + limit,
  // mirroring the list_test_cases lean shape.
  if (lean) {
    const limitParam = searchParams.get('limit');
    const rawLimit = limitParam ? parseInt(limitParam, 10) : LIST_LIMIT_DEFAULT;
    const clampedLimit = Math.min(
      isNaN(rawLimit) || rawLimit < 1 ? LIST_LIMIT_DEFAULT : rawLimit,
      LIST_LIMIT_MAX,
    );

    let query = supabase
      .from('projects')
      .select('id, name')
      .order('created_at', { ascending: false });
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error } = await query;
    if (error) return serverError(error.message);

    const all = data ?? [];
    const total = all.length;
    const items = all
      .slice(0, clampedLimit)
      .map((p) => ({ project_id: p.id, name: p.name }));

    return NextResponse.json({ items, total, has_more: total > items.length });
  }

  // Full projection (browser path) — unchanged shape: array enriched with suite/test-case counts.
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
