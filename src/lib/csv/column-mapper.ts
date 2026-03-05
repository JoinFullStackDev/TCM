export type SystemField =
  | 'display_id'
  | 'description'
  | 'precondition'
  | 'step_number'
  | 'step_description'
  | 'test_data'
  | 'expected_result'
  | 'platform_results'
  | 'automation_status_cell'
  | 'comments'
  | 'bug_link'
  | 'overall_status'
  | 'execution_date'
  | 'unmapped';

export interface MappingEntry {
  csvIndex: number;
  csvHeader: string;
  systemField: SystemField;
  confidence: 'high' | 'medium' | 'low';
}

const EXACT_MATCHES: Record<string, SystemField> = {
  id: 'display_id',
  description: 'description',
  precondition: 'precondition',
  'test step #': 'step_number',
  'test step description': 'step_description',
  'test data': 'test_data',
  'test step expected result': 'expected_result',
  'test steps expected results': 'expected_result',
  'test step expected results': 'expected_result',
  'test steps expected result': 'expected_result',
  'pass/fail/comments if fail': 'platform_results',
  'added to code': 'automation_status_cell',
  comments: 'comments',
  'bug report': 'bug_link',
};

const FUZZY_MATCHES: [RegExp, SystemField][] = [
  [/^id$/i, 'display_id'],
  [/desc/i, 'description'],
  [/precondition/i, 'precondition'],
  [/step\s*#|step\s*num/i, 'step_number'],
  [/step.*desc/i, 'step_description'],
  [/test\s*data/i, 'test_data'],
  [/expected.*result/i, 'expected_result'],
  [/pass.*fail|result.*status/i, 'platform_results'],
  [/added.*code|automation/i, 'automation_status_cell'],
  [/comment/i, 'comments'],
  [/bug.*report|bug.*link/i, 'bug_link'],
  [/overall.*status|status.*overall/i, 'overall_status'],
  [/execut.*date|date.*execut|last.*run|run.*date/i, 'execution_date'],
];

/**
 * Auto-detects column mappings from a CSV header row.
 */
export function autoDetectMappings(headerRow: string[]): MappingEntry[] {
  const usedFields = new Set<SystemField>();
  const mappings: MappingEntry[] = [];

  for (let i = 0; i < headerRow.length; i++) {
    const raw = headerRow[i]?.trim() ?? '';
    if (!raw) {
      mappings.push({
        csvIndex: i,
        csvHeader: raw,
        systemField: 'unmapped',
        confidence: 'low',
      });
      continue;
    }

    const normalized = raw.toLowerCase().replace(/\s+/g, ' ');

    const exactMatch = EXACT_MATCHES[normalized];
    if (exactMatch && !usedFields.has(exactMatch)) {
      usedFields.add(exactMatch);
      mappings.push({
        csvIndex: i,
        csvHeader: raw,
        systemField: exactMatch,
        confidence: 'high',
      });
      continue;
    }

    let found = false;
    for (const [regex, field] of FUZZY_MATCHES) {
      if (regex.test(raw) && !usedFields.has(field)) {
        usedFields.add(field);
        mappings.push({
          csvIndex: i,
          csvHeader: raw,
          systemField: field,
          confidence: 'medium',
        });
        found = true;
        break;
      }
    }

    if (!found) {
      mappings.push({
        csvIndex: i,
        csvHeader: raw,
        systemField: 'unmapped',
        confidence: 'low',
      });
    }
  }

  return mappings;
}

export const SYSTEM_FIELD_LABELS: Record<SystemField, string> = {
  display_id: 'Test Case ID',
  description: 'Description',
  precondition: 'Precondition',
  step_number: 'Step Number',
  step_description: 'Step Description',
  test_data: 'Test Data',
  expected_result: 'Expected Result',
  platform_results: 'Pass/Fail Results',
  automation_status_cell: 'Automation Status',
  comments: 'Comments',
  bug_link: 'Bug Report URL',
  overall_status: 'Overall Status',
  execution_date: 'Execution Date',
  unmapped: '(Unmapped)',
};
