import { NextResponse } from 'next/server';
import { withAuth, validationError, serverError, notFound } from '@/lib/api/helpers';
import { createServiceClient } from '@/lib/supabase/server';
import { parseRequestSchema } from '@/lib/validations/csv-import';
import { parseCSV } from '@/lib/csv/parser';
import { parseTestCasesFromRows, buildColumnLookupFromMappings } from '@/lib/csv/parse-test-cases';

export async function POST(request: Request) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;
  const serviceClient = await createServiceClient();

  const body = await request.json();
  const parsed = parseRequestSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { import_id, confirmed_mappings } = parsed.data;

  const { data: importRow, error: fetchErr } = await supabase
    .from('csv_imports')
    .select('*')
    .eq('id', import_id)
    .single();

  if (fetchErr || !importRow) return notFound('Import record');

  const storagePath = `${importRow.project_id}/${import_id}.csv`;
  const { data: fileData, error: downloadErr } = await serviceClient.storage
    .from('csv-imports')
    .download(storagePath);

  if (downloadErr || !fileData) {
    return serverError(`Failed to download CSV: ${downloadErr?.message ?? 'File not found'}`);
  }

  const csvText = await fileData.text();
  const rows = parseCSV(csvText);

  const columnLookup = buildColumnLookupFromMappings(confirmed_mappings);
  const testCases = parseTestCasesFromRows(rows, columnLookup);

  const mappingObj: Record<string, string> = {};
  for (const m of confirmed_mappings) {
    mappingObj[String(m.csvIndex)] = m.systemField;
  }
  await supabase
    .from('csv_imports')
    .update({
      column_mappings: mappingObj,
      total_rows: testCases.length,
    })
    .eq('id', import_id);

  const { data: existingSuites } = await supabase
    .from('suites')
    .select('id, name, prefix')
    .eq('project_id', importRow.project_id);

  const { data: existingCases } = await supabase
    .from('test_cases')
    .select('display_id')
    .in('suite_id', (existingSuites ?? []).map((s) => s.id));

  const existingIds = new Set(
    (existingCases ?? []).map((tc) => tc.display_id),
  );
  const duplicateIds = testCases
    .filter((tc) => existingIds.has(tc.display_id))
    .map((tc) => tc.display_id);

  const preview = testCases.slice(0, 20);

  return NextResponse.json({
    import_id,
    total_test_cases: testCases.length,
    total_steps: testCases.reduce((sum, tc) => sum + tc.steps.length, 0),
    suites: [...new Set(testCases.map((tc) => tc.suite_name))],
    duplicate_ids: duplicateIds,
    preview,
  });
}
