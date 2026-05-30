import { NextResponse } from 'next/server';
import { withDualAuth, validationError, serverError } from '@/lib/api/helpers';
import { z } from 'zod';

const schema = z.object({
  author: z.string().min(1).max(256),
  note: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withDualAuth(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { data, error } = await supabase
    .from('run_notes')
    .insert({ run_id: id, author: parsed.data.author, note: parsed.data.note })
    .select()
    .single();

  if (error) return serverError(error.message);
  return NextResponse.json(data, { status: 201 });
}
