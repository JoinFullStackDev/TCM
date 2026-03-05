import { NextResponse } from 'next/server';
import { withAuth, serverError, validationError } from '@/lib/api/helpers';
import { createServiceClient } from '@/lib/supabase/server';
import { parseCSV } from '@/lib/csv/parser';
import { findColumnHeaderRow } from '@/lib/csv/classifier';
import { autoDetectMappings } from '@/lib/csv/column-mapper';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;
  const serviceClient = await createServiceClient();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return validationError('Request must be multipart/form-data');
  }

  const file = formData.get('file') as File | null;
  const projectId = formData.get('project_id') as string | null;

  if (!file || !projectId) {
    return validationError('file and project_id are required');
  }

  if (!file.name.toLowerCase().endsWith('.csv')) {
    return validationError('File must be a .csv file');
  }

  if (file.size > 50 * 1024 * 1024) {
    return validationError('File must be under 50MB');
  }

  const csvText = await file.text();

  const { data: importRow, error: importErr } = await supabase
    .from('csv_imports')
    .insert({
      project_id: projectId,
      file_name: file.name,
      file_size: file.size,
      status: 'pending',
      imported_by: user.id,
    })
    .select()
    .single();

  if (importErr || !importRow) {
    return serverError(importErr?.message ?? 'Failed to create import record');
  }

  const storagePath = `${projectId}/${importRow.id}.csv`;
  const { error: uploadErr } = await serviceClient.storage
    .from('csv-imports')
    .upload(storagePath, csvText, {
      contentType: 'text/csv',
      upsert: true,
    });

  if (uploadErr) {
    await supabase.from('csv_imports').delete().eq('id', importRow.id);
    return serverError(`Storage upload failed: ${uploadErr.message}`);
  }

  const rows = parseCSV(csvText);
  const totalRows = rows.length;

  const columnHeaderRow = findColumnHeaderRow(rows);
  let mappings = columnHeaderRow ? autoDetectMappings(columnHeaderRow) : [];

  if (mappings.length === 0 && rows.length > 0) {
    mappings = autoDetectMappings(rows[0]);
  }

  const previewRows = rows.slice(0, 50);

  return NextResponse.json({
    import_id: importRow.id,
    file_name: file.name,
    file_size: file.size,
    total_rows: totalRows,
    mappings,
    preview_rows: previewRows,
    storage_path: storagePath,
  }, { status: 201 });
}
