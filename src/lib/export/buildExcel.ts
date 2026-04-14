import ExcelJS from 'exceljs';
import type { ExportSnapshot, ExportSuite, ExportTestCase, ExportStep } from './fetchExportSnapshot';
import { getSuiteColor, HEADER_ROW_COLOR, INDEX_HEADER_COLOR } from './colorPalette';
import { deduplicateTabNames, truncateTabName } from './sanitizeFilename';
import { guardForExcel } from './formulaGuard';

const COLUMNS = [
  { key: 'A', header: 'Id', width: 14 },
  { key: 'B', header: 'Description', width: 32 },
  { key: 'C', header: 'Precondition', width: 32 },
  { key: 'D', header: 'Test Step #', width: 10 },
  { key: 'E', header: 'Test Step Description', width: 42 },
  { key: 'F', header: 'Test Data', width: 26 },
  { key: 'G', header: 'Test Step Expected Result', width: 42 },
  { key: 'H', header: 'Pass/Fail/Comments if Fail', width: 22 },
  { key: 'I', header: 'Added to code', width: 14 },
  { key: 'J', header: 'Comments', width: 26 },
  { key: 'K', header: 'Bug report', width: 30 },
];

const AUTOMATION_STATUS_LABELS: Record<string, string> = {
  not_automated: 'Not Automated',
  scripted: 'Scripted',
  in_cicd: 'In CI/CD',
  out_of_sync: 'Out of Sync',
};

function getAutomationLabel(status: string | null): string {
  if (!status) return '';
  return AUTOMATION_STATUS_LABELS[status] ?? status;
}

function applyHeaderRow(ws: ExcelJS.Worksheet, rowIndex: number) {
  const row = ws.getRow(rowIndex);
  COLUMNS.forEach((col, i) => {
    const cell = row.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_ROW_COLOR },
    };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.numFmt = '@';
  });
  row.commit();
}

function applyTitleRow(
  ws: ExcelJS.Worksheet,
  rowIndex: number,
  tc: ExportTestCase,
  colorArgb: string,
) {
  const row = ws.getRow(rowIndex);

  // Cols A–B merged: "Test Case Title display_id"
  const titleCell = row.getCell(1);
  titleCell.value = `${tc.title} ${tc.display_id}`;
  titleCell.font = { bold: true };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorArgb } };
  titleCell.alignment = { vertical: 'middle', wrapText: true };
  titleCell.numFmt = '@';

  // Col C: automation_status label
  const statusCell = row.getCell(3);
  statusCell.value = getAutomationLabel(tc.automation_status);
  statusCell.font = { bold: true };
  statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorArgb } };
  statusCell.alignment = { vertical: 'middle', wrapText: true };
  statusCell.numFmt = '@';

  // Fill remaining cols with the color but leave blank
  for (let i = 4; i <= COLUMNS.length; i++) {
    const cell = row.getCell(i);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorArgb } };
  }

  row.commit();
  // Merge A–B on title row
  ws.mergeCells(rowIndex, 1, rowIndex, 2);
}

function writeStepRows(
  ws: ExcelJS.Worksheet,
  startRow: number,
  tc: ExportTestCase,
): number {
  const steps = tc.steps ?? [];
  const firstBugUrl = tc.bug_links?.[0]?.url ?? '';
  const automationLabel = getAutomationLabel(tc.automation_status);

  if (steps.length === 0) {
    // No steps — write one placeholder row with merged A/B/C
    const row = ws.getRow(startRow);
    row.getCell(1).value = guardForExcel(tc.display_id);
    row.getCell(2).value = guardForExcel(tc.description);
    row.getCell(3).value = guardForExcel(tc.precondition);
    row.getCell(9).value = guardForExcel(automationLabel);
    row.getCell(11).value = guardForExcel(firstBugUrl);
    for (let c = 1; c <= COLUMNS.length; c++) {
      const cell = row.getCell(c);
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.numFmt = '@';
    }
    row.commit();
    return startRow + 1;
  }

  steps.forEach((step: ExportStep, idx: number) => {
    const rowIndex = startRow + idx;
    const row = ws.getRow(rowIndex);

    row.getCell(1).value = guardForExcel(tc.display_id);
    row.getCell(2).value = guardForExcel(tc.description);
    row.getCell(3).value = guardForExcel(tc.precondition);
    row.getCell(4).value = step.step_number;
    row.getCell(5).value = guardForExcel(step.description);
    row.getCell(6).value = guardForExcel(step.test_data);
    row.getCell(7).value = guardForExcel(step.expected_result);
    row.getCell(8).value = ''; // Pass/Fail — always blank (GAP-04)
    row.getCell(9).value = guardForExcel(automationLabel); // Added to code (GAP-02)
    row.getCell(10).value = ''; // Comments — blank (GAP-03: no run annotations at export time)
    row.getCell(11).value = guardForExcel(firstBugUrl);

    for (let c = 1; c <= COLUMNS.length; c++) {
      const cell = row.getCell(c);
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.numFmt = '@';
    }
    row.commit();
  });

  // Vertical merge on A, B, C across all step rows
  if (steps.length > 1) {
    const endRow = startRow + steps.length - 1;
    ws.mergeCells(startRow, 1, endRow, 1);
    ws.mergeCells(startRow, 2, endRow, 2);
    ws.mergeCells(startRow, 3, endRow, 3);
  }

  return startRow + steps.length;
}

function addSuiteSheet(
  wb: ExcelJS.Workbook,
  suite: ExportSuite,
  tabName: string,
): void {
  const ws = wb.addWorksheet(tabName);

  // Set column widths
  COLUMNS.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width;
  });

  const colorArgb = getSuiteColor(suite.color_index);
  const testCases = suite.test_cases ?? [];

  if (testCases.length === 0) {
    // Empty suite
    ws.getCell('A1').value = suite.name;
    ws.getCell('A1').font = { bold: true };
    ws.getCell('A2').value = 'No test cases in this suite.';
    ws.getRow(1).commit();
    ws.getRow(2).commit();
    return;
  }

  // Add the full suite name as a note on A1 (useful when tab name was truncated)
  let currentRow = 1;

  for (const tc of testCases) {
    // Title row
    applyTitleRow(ws, currentRow, tc, colorArgb);
    currentRow++;

    // Header row
    applyHeaderRow(ws, currentRow);
    currentRow++;

    // Step rows
    currentRow = writeStepRows(ws, currentRow, tc);

    // Blank separator row
    ws.getRow(currentRow).commit();
    currentRow++;
  }
}

function addIndexSheet(wb: ExcelJS.Workbook, snapshot: ExportSnapshot): void {
  const ws = wb.addWorksheet('Summary', { properties: {} });
  // Move Summary to first position
  // ExcelJS uses orderNo on addWorksheet; we just add it first so it's already first

  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 16;
  ws.getColumn(3).width = 50;
  ws.getColumn(4).width = 20;

  // Header row
  const headers = ['Suite Name', 'Test Case ID', 'Test Case Title', 'Status'];
  const headerRow = ws.getRow(1);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDEX_HEADER_COLOR } };
    cell.alignment = { vertical: 'middle' };
    cell.numFmt = '@';
  });
  headerRow.commit();

  let rowIndex = 2;
  for (const suite of snapshot.suites) {
    for (const tc of suite.test_cases ?? []) {
      const row = ws.getRow(rowIndex);
      row.getCell(1).value = guardForExcel(suite.name);
      row.getCell(2).value = guardForExcel(tc.display_id);
      row.getCell(3).value = guardForExcel(tc.title);
      row.getCell(4).value = ''; // Status blank
      for (let c = 1; c <= 4; c++) {
        row.getCell(c).numFmt = '@';
      }
      row.commit();
      rowIndex++;
    }
  }
}

/**
 * Build an ExcelJS workbook from an export snapshot.
 * Returns the workbook buffer as a Buffer.
 */
export async function buildExcel(snapshot: ExportSnapshot): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TestForge';
  wb.created = new Date();

  // Always add Summary tab first
  addIndexSheet(wb, snapshot);

  // Deduplicate tab names across all suites
  const rawNames = snapshot.suites.map((s) => truncateTabName(s.name));
  const tabNames = deduplicateTabNames(rawNames.map((_, i) => snapshot.suites[i].name));

  for (let i = 0; i < snapshot.suites.length; i++) {
    addSuiteSheet(wb, snapshot.suites[i], tabNames[i]);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
