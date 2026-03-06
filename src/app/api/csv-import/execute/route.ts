import { NextResponse } from 'next/server';
import { withAuth, validationError, serverError, notFound } from '@/lib/api/helpers';
import { createServiceClient } from '@/lib/supabase/server';
import { executeRequestSchema, type ParsedTestCase } from '@/lib/validations/csv-import';
import { parseCSV } from '@/lib/csv/parser';
import { parseTestCasesFromRows } from '@/lib/csv/parse-test-cases';
import { detectProvider } from '@/lib/csv/field-parsers';
import type { SupabaseClient } from '@supabase/supabase-js';

const BATCH_SIZE = 50;

async function updateProgress(
  supabase: SupabaseClient,
  importId: string,
  importedCount: number,
  skippedCount: number,
  errorCount: number,
) {
  await supabase
    .from('csv_imports')
    .update({ imported_count: importedCount, skipped_count: skippedCount, error_count: errorCount })
    .eq('id', importId);
}

export async function POST(request: Request) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;
  const serviceClient = await createServiceClient();

  const body = await request.json();
  const parsed = executeRequestSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { import_id, duplicate_strategy } = parsed.data;

  const { data: importRow, error: fetchErr } = await supabase
    .from('csv_imports')
    .select('*')
    .eq('id', import_id)
    .single();

  if (fetchErr || !importRow) return notFound('Import record');

  await supabase
    .from('csv_imports')
    .update({ status: 'processing' })
    .eq('id', import_id);

  const storagePath = `${importRow.project_id}/${import_id}.csv`;
  const { data: fileData, error: downloadErr } = await serviceClient.storage
    .from('csv-imports')
    .download(storagePath);

  if (downloadErr || !fileData) {
    await supabase.from('csv_imports').update({ status: 'failed' }).eq('id', import_id);
    return serverError(`Failed to download CSV: ${downloadErr?.message ?? 'File not found'}`);
  }

  const csvText = await fileData.text();
  const rows = parseCSV(csvText);

  const savedMappings = importRow.column_mappings as Record<string, string> | null;
  let columnLookup: Record<string, number> = {};
  if (savedMappings) {
    for (const [idx, field] of Object.entries(savedMappings)) {
      if (field !== 'unmapped') {
        columnLookup[field] = parseInt(idx, 10);
      }
    }
  }

  const testCases = parseTestCasesFromRows(rows, columnLookup);

  const { data: existingSuites } = await supabase
    .from('suites')
    .select('id, name, prefix, next_sequence')
    .eq('project_id', importRow.project_id);

  const suiteMap = new Map(
    (existingSuites ?? []).map((s) => [s.prefix, s]),
  );

  const { data: existingCases } = await supabase
    .from('test_cases')
    .select('id, display_id, suite_id')
    .in('suite_id', (existingSuites ?? []).map((s) => s.id));

  const existingCaseMap = new Map(
    (existingCases ?? []).map((tc) => [tc.display_id, tc]),
  );

  let suiteColorIdx = (existingSuites ?? []).length;
  let importedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const errors: Array<{ row_number: number | null; error_message: string }> = [];

  for (let batchStart = 0; batchStart < testCases.length; batchStart += BATCH_SIZE) {
    const batch = testCases.slice(batchStart, batchStart + BATCH_SIZE);

    for (let i = 0; i < batch.length; i++) {
      const tc = batch[i];
      const globalIdx = batchStart + i;

      try {
        let suite = suiteMap.get(tc.prefix);
        if (!suite) {
          const { data: newSuite, error: suiteErr } = await supabase
            .from('suites')
            .insert({
              project_id: importRow.project_id,
              name: tc.suite_name,
              prefix: tc.prefix,
              color_index: suiteColorIdx % 5,
              position: suiteColorIdx,
              next_sequence: 1,
              created_by: user.id,
            })
            .select()
            .single();

          if (suiteErr || !newSuite) {
            errors.push({ row_number: globalIdx + 1, error_message: `Failed to create suite "${tc.prefix}": ${suiteErr?.message ?? 'unknown'}` });
            errorCount++;
            continue;
          }
          suite = newSuite;
          suiteMap.set(tc.prefix, newSuite);
          suiteColorIdx++;
        }

        const existingCase = existingCaseMap.get(tc.display_id);
        if (existingCase) {
          if (duplicate_strategy === 'skip') {
            skippedCount++;
            continue;
          }

          await supabase.from('test_cases').update({
            title: tc.title,
            description: tc.description,
            precondition: tc.precondition,
            automation_status: tc.automation_status,
            platform_tags: tc.platform_tags,
            updated_by: user.id,
          }).eq('id', existingCase.id);

          await supabase.from('test_steps').delete().eq('test_case_id', existingCase.id);
          if (tc.steps.length > 0) {
            await insertSteps(supabase, existingCase.id, tc.steps);
          }
          importedCount++;
          continue;
        }

        if (!suite) {
          errors.push({ row_number: globalIdx + 1, error_message: `No suite found for ${tc.display_id}` });
          errorCount++;
          continue;
        }

        const maxSeq = Math.max(suite.next_sequence ?? 1, tc.sequence_number + 1);
        const { data: newCase, error: caseErr } = await supabase
          .from('test_cases')
          .insert({
            suite_id: suite.id,
            display_id: tc.display_id,
            sequence_number: tc.sequence_number,
            title: tc.title,
            description: tc.description,
            precondition: tc.precondition,
            type: 'functional',
            automation_status: tc.automation_status,
            platform_tags: tc.platform_tags,
            tags: [],
            position: tc.sequence_number,
            created_by: user.id,
            updated_by: user.id,
          })
          .select()
          .single();

        if (caseErr || !newCase) {
          errors.push({ row_number: globalIdx + 1, error_message: `Failed to create ${tc.display_id}: ${caseErr?.message ?? 'unknown'}` });
          errorCount++;
          continue;
        }

        await supabase.from('suites').update({ next_sequence: maxSeq }).eq('id', suite.id);
        suite.next_sequence = maxSeq;

        if (tc.steps.length > 0) {
          await insertSteps(supabase, newCase.id, tc.steps);
        }

        const allBugLinks = [...new Set(tc.bug_links ?? [])];
        if (allBugLinks.length > 0) {
          const linkRows = allBugLinks.map((url) => ({
            test_case_id: newCase.id,
            url,
            provider: detectProvider(url),
            created_by: user.id,
          }));
          await supabase.from('bug_links').insert(linkRows);
        }

        existingCaseMap.set(tc.display_id, { id: newCase.id, display_id: tc.display_id, suite_id: suite.id });
        importedCount++;
      } catch (err) {
        errors.push({ row_number: globalIdx + 1, error_message: `Unexpected error for ${tc.display_id}: ${err instanceof Error ? err.message : 'unknown'}` });
        errorCount++;
      }
    }

    await updateProgress(supabase, import_id, importedCount, skippedCount, errorCount);
  }

  if (errors.length > 0) {
    const errorRows = errors.map((e) => ({
      import_id: import_id,
      row_number: e.row_number,
      error_message: e.error_message,
    }));
    await supabase.from('csv_import_errors').insert(errorRows);
  }

  let importRunId: string | null = null;
  const hasPlatformResults = testCases.some((tc) =>
    tc.steps.some((s) => s.platform_results && s.platform_results.length > 0),
  );

  if (hasPlatformResults && importedCount > 0) {
    importRunId = await createImportTestRun(supabase, importRow, testCases, existingCaseMap, user.id);
  }

  await supabase.from('csv_imports').update({
    imported_count: importedCount,
    skipped_count: skippedCount,
    error_count: errorCount,
    status: errorCount > 0 && importedCount === 0 ? 'failed' : 'completed',
    completed_at: new Date().toISOString(),
  }).eq('id', import_id);

  return NextResponse.json({
    import_id,
    imported_count: importedCount,
    skipped_count: skippedCount,
    error_count: errorCount,
    errors,
    import_run_id: importRunId,
  });
}

async function insertSteps(
  supabase: SupabaseClient,
  testCaseId: string,
  steps: ParsedTestCase['steps'],
) {
  const stepRows = steps.map((s) => ({
    test_case_id: testCaseId,
    step_number: s.step_number,
    description: s.description,
    test_data: s.test_data ?? null,
    expected_result: s.expected_result ?? null,
    is_automation_only: s.is_automation_only,
  }));
  await supabase.from('test_steps').insert(stepRows);
}

async function createImportTestRun(
  supabase: SupabaseClient,
  importRow: { id: string; project_id: string; file_name: string },
  testCases: ParsedTestCase[],
  existingCaseMap: Map<string, { id: string; display_id: string; suite_id: string }>,
  userId: string,
): Promise<string | null> {
  const firstSuitePrefix = testCases[0]?.prefix ?? 'Import';
  const { data: importRun } = await supabase
    .from('test_runs')
    .insert({
      project_id: importRow.project_id,
      name: `Import — ${firstSuitePrefix}`,
      description: `Auto-created from CSV import: ${importRow.file_name}`,
      status: 'completed',
      is_automated: false,
      source: 'csv_import',
      completed_at: new Date().toISOString(),
      created_by: userId,
    })
    .select()
    .single();

  if (!importRun) return null;

  const statusPriority: Record<string, number> = { fail: 4, blocked: 3, skip: 2, not_run: 1, pass: 0 };

  for (const tc of testCases) {
    const caseInfo = existingCaseMap.get(tc.display_id);
    if (!caseInfo) continue;

    const { data: trc } = await supabase.from('test_run_cases').insert({
      test_run_id: importRun.id,
      test_case_id: caseInfo.id,
      overall_status: 'not_run',
    }).select('id').single();

    if (!trc) continue;

    const allStatuses: string[] = [];

    for (const step of tc.steps) {
      if (!step.platform_results || step.platform_results.length === 0) continue;

      const { data: dbSteps } = await supabase
        .from('test_steps')
        .select('id, step_number')
        .eq('test_case_id', caseInfo.id)
        .eq('step_number', step.step_number)
        .limit(1);

      const stepRow = dbSteps?.[0];
      if (!stepRow) continue;

      const resultRows = step.platform_results.map((pr) => ({
        test_run_id: importRun.id,
        test_case_id: caseInfo.id,
        test_step_id: stepRow.id,
        platform: pr.platform,
        browser: 'default',
        status: pr.status,
        executed_by: userId,
        executed_at: tc.execution_dates?.completionDate ?? new Date().toISOString(),
      }));

      await supabase.from('execution_results').insert(resultRows);
      allStatuses.push(...resultRows.map((r) => r.status));
    }

    if (allStatuses.length > 0) {
      let worst = 'pass';
      let worstP = 0;
      for (const s of allStatuses) {
        const p = statusPriority[s] ?? 0;
        if (p > worstP) { worst = s; worstP = p; }
      }
      await supabase.from('test_run_cases').update({ overall_status: worst }).eq('id', trc.id);
    }
  }

  return importRun.id;
}
