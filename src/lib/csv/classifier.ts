export type RowType =
  | 'header'
  | 'column_header'
  | 'automation_only'
  | 'first_step'
  | 'step'
  | 'empty';

const DISPLAY_ID_RE = /^[A-Z]{1,10}-\d+$/;
const HEADER_RE = /^.+\s+[A-Z]{1,10}-\d+$/;

/**
 * Fixed column positions in the Google Sheets test-case HEADER row.
 * These are structural — they never change regardless of column mapping.
 *
 * Header row layout: [suite+id, empty, overall_status, empty, automation_status, empty, empty, execution_dates, ...]
 */
export const HEADER_ROW_POSITIONS = {
  SUITE_AND_ID: 0,
  OVERALL_STATUS: 2,
  AUTOMATION_STATUS: 4,
  EXECUTION_DATES: 7,
} as const;

/**
 * Detects the type of a CSV row from the Google Sheets export format.
 *
 * Row patterns:
 *   header:          "Sponsor Registration SR-1,,Manual Testing Complete,,IN CICD,..."
 *   column_header:   "Id,Description,Precondition,Test Step #,..."
 *   automation_only: ",,,**Automation Only**,description,..."
 *   first_step:      "SR-1,description,precondition,1,step desc,..."
 *   step:            ",,,2,step desc,..."
 *   empty:           all cells blank
 */
export function classifyRow(row: string[], stepColIndex = 3): RowType {
  if (row.every((cell) => cell.trim() === '')) return 'empty';

  const first = row[0]?.trim() ?? '';
  const second = row[1]?.trim().toLowerCase() ?? '';

  if (
    (first.toLowerCase() === 'id' || first === ' ' || first === '') &&
    (second === 'description' || second === 'test step description')
  ) {
    return 'column_header';
  }

  const stepCell = row[stepColIndex]?.trim() ?? '';
  if (stepCell.includes('**Automation Only**')) return 'automation_only';

  if (HEADER_RE.test(first)) {
    const hasStepData = /^\d+$/.test(stepCell);
    if (!hasStepData) return 'header';
  }

  if (DISPLAY_ID_RE.test(first)) return 'first_step';

  const hasStepNumber = /^\d+$/.test(stepCell);
  if (hasStepNumber) return 'step';

  if (first === '' && stepCell === '' && row.some((c) => c.trim() !== '')) {
    return 'step';
  }

  return 'empty';
}

/**
 * Finds the column index of "Test Step #" from a column header row.
 */
export function findStepNumberColumn(headerRow: string[]): number {
  const idx = headerRow.findIndex(
    (h) => h.trim().toLowerCase().replace(/\s+/g, ' ') === 'test step #',
  );
  return idx >= 0 ? idx : 3;
}

/**
 * Scans rows to find the first column header row and returns it.
 */
export function findColumnHeaderRow(rows: string[][]): string[] | null {
  for (const row of rows) {
    if (row.every((cell) => cell.trim() === '')) continue;
    const first = row[0]?.trim() ?? '';
    const second = row[1]?.trim().toLowerCase() ?? '';
    if (
      (first.toLowerCase() === 'id' || first === ' ' || first === '') &&
      (second === 'description' || second === 'test step description')
    ) {
      return row;
    }
  }
  return null;
}
