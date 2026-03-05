import { NextResponse } from 'next/server';
import { withAuth, validationError, serverError } from '@/lib/api/helpers';
import { importPayloadSchema } from '@/lib/validations/csv-import';
import { detectProvider } from '@/lib/csv/field-parsers';

export async function POST(request: Request) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const body = await request.json();
  const parsed = importPayloadSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { project_id, parsed_data, duplicate_strategy, file_name, file_size, column_mappings } =
    parsed.data;

  const { data: importRow, error: importErr } = await supabase
    .from('csv_imports')
    .insert({
      project_id,
      file_name,
      file_size: file_size ?? null,
      column_mappings,
      total_rows: parsed_data.length,
      status: 'processing',
      imported_by: user.id,
    })
    .select()
    .single();

  if (importErr || !importRow) return serverError(importErr?.message ?? 'Failed to create import record');

  let importedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const errors: Array<{ row_number: number | null; error_message: string }> = [];

  const { data: existingSuites } = await supabase
    .from('suites')
    .select('id, name, prefix, next_sequence')
    .eq('project_id', project_id);

  const suiteMap = new Map(
    (existingSuites ?? []).map((s) => [s.prefix, s]),
  );

  const { data: existingCases } = await supabase
    .from('test_cases')
    .select('id, display_id, suite_id')
    .in(
      'suite_id',
      (existingSuites ?? []).map((s) => s.id),
    );

  const existingCaseMap = new Map(
    (existingCases ?? []).map((tc) => [tc.display_id, tc]),
  );

  let suiteColorIdx = (existingSuites ?? []).length;

  for (let i = 0; i < parsed_data.length; i++) {
    const tc = parsed_data[i];

    try {
      let suite = suiteMap.get(tc.prefix);
      if (!suite) {
        const { data: newSuite, error: suiteErr } = await supabase
          .from('suites')
          .insert({
            project_id,
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
          errors.push({
            row_number: i + 1,
            error_message: `Failed to create suite "${tc.prefix}": ${suiteErr?.message ?? 'unknown'}`,
          });
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

        const { error: updateErr } = await supabase
          .from('test_cases')
          .update({
            title: tc.title,
            description: tc.description,
            precondition: tc.precondition,
            automation_status: tc.automation_status,
            platform_tags: tc.platform_tags,
            updated_by: user.id,
          })
          .eq('id', existingCase.id);

        if (updateErr) {
          errors.push({
            row_number: i + 1,
            error_message: `Failed to update ${tc.display_id}: ${updateErr.message}`,
          });
          errorCount++;
          continue;
        }

        await supabase
          .from('test_steps')
          .delete()
          .eq('test_case_id', existingCase.id);

        if (tc.steps.length > 0) {
          const stepRows = tc.steps.map((s) => ({
            test_case_id: existingCase.id,
            step_number: s.step_number,
            description: s.description,
            test_data: s.test_data ?? null,
            expected_result: s.expected_result ?? null,
            is_automation_only: s.is_automation_only,
          }));

          await supabase.from('test_steps').insert(stepRows);
        }

        importedCount++;
        continue;
      }

      if (!suite) {
        errors.push({
          row_number: i + 1,
          error_message: `No suite found for ${tc.display_id}`,
        });
        errorCount++;
        continue;
      }

      const maxSeq = Math.max(
        suite.next_sequence ?? 1,
        tc.sequence_number + 1,
      );

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
        errors.push({
          row_number: i + 1,
          error_message: `Failed to create ${tc.display_id}: ${caseErr?.message ?? 'unknown'}`,
        });
        errorCount++;
        continue;
      }

      await supabase
        .from('suites')
        .update({ next_sequence: maxSeq })
        .eq('id', suite.id);
      suite.next_sequence = maxSeq;

      if (tc.steps.length > 0) {
        const stepRows = tc.steps.map((s) => ({
          test_case_id: newCase.id,
          step_number: s.step_number,
          description: s.description,
          test_data: s.test_data ?? null,
          expected_result: s.expected_result ?? null,
          is_automation_only: s.is_automation_only,
        }));

        await supabase.from('test_steps').insert(stepRows);
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

      existingCaseMap.set(tc.display_id, {
        id: newCase.id,
        display_id: tc.display_id,
        suite_id: suite.id,
      });
      importedCount++;
    } catch (err) {
      errors.push({
        row_number: i + 1,
        error_message: `Unexpected error for ${tc.display_id}: ${err instanceof Error ? err.message : 'unknown'}`,
      });
      errorCount++;
    }
  }

  if (errors.length > 0) {
    const errorRows = errors.map((e) => ({
      import_id: importRow.id,
      row_number: e.row_number,
      error_message: e.error_message,
    }));
    await supabase.from('csv_import_errors').insert(errorRows);
  }

  // Auto-create import test run for platform results
  const hasPlatformResults = parsed_data.some((tc) =>
    tc.steps.some((s) => s.platform_results && s.platform_results.length > 0),
  );

  let importRunId: string | null = null;
  if (hasPlatformResults && importedCount > 0) {
    const firstSuitePrefix = parsed_data[0]?.prefix ?? 'Import';
    const { data: importRun } = await supabase
      .from('test_runs')
      .insert({
        project_id,
        name: `Import — ${firstSuitePrefix}`,
        description: `Auto-created from CSV import: ${file_name}`,
        status: 'completed',
        is_automated: false,
        source: 'csv_import',
        completed_at: new Date().toISOString(),
        created_by: user.id,
      })
      .select()
      .single();

    if (importRun) {
      importRunId = importRun.id;

      for (const tc of parsed_data) {
        const caseInfo = existingCaseMap.get(tc.display_id);
        if (!caseInfo) continue;

        await supabase.from('test_run_cases').insert({
          test_run_id: importRun.id,
          test_case_id: caseInfo.id,
          overall_status: 'not_run',
        });

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
            executed_by: user.id,
            executed_at: tc.execution_dates?.completionDate ?? new Date().toISOString(),
          }));

          await supabase.from('execution_results').insert(resultRows);
        }
      }
    }
  }

  await supabase
    .from('csv_imports')
    .update({
      imported_count: importedCount,
      skipped_count: skippedCount,
      error_count: errorCount,
      status: errorCount > 0 && importedCount === 0 ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', importRow.id);

  return NextResponse.json({
    import_id: importRow.id,
    imported_count: importedCount,
    skipped_count: skippedCount,
    error_count: errorCount,
    errors,
    import_run_id: importRunId,
  });
}
