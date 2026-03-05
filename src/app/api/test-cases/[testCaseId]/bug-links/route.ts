import { NextResponse } from 'next/server';
import { withAuth, validationError, serverError } from '@/lib/api/helpers';
import { createBugLinkSchema, detectProvider } from '@/lib/validations/bug-link';

interface RouteContext {
  params: Promise<{ testCaseId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await withAuth('read');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { testCaseId } = await context.params;

  const { data, error } = await supabase
    .from('bug_links')
    .select('*')
    .eq('test_case_id', testCaseId)
    .order('created_at', { ascending: false });

  if (error) return serverError(error.message);

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;
  const { testCaseId } = await context.params;

  const body = await request.json();
  const parsed = createBugLinkSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const provider = parsed.data.provider || detectProvider(parsed.data.url);

  const { data, error } = await supabase
    .from('bug_links')
    .insert({
      test_case_id: testCaseId,
      url: parsed.data.url,
      title: parsed.data.title ?? null,
      external_id: parsed.data.external_id ?? null,
      provider,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data, { status: 201 });
}
