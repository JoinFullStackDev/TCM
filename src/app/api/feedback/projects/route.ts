import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { serverError } from '@/lib/api/helpers';

// GET /api/feedback/projects — PUBLIC, returns active projects for form dropdown
export async function GET() {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .eq('is_archived', false)
    .order('name', { ascending: true });

  if (error) return serverError(error.message);

  return NextResponse.json(data ?? []);
}
