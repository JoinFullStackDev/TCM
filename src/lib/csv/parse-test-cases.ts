import { classifyRow } from './classifier';
import {
  parseHeaderRow,
  parsePlatformResults,
  extractPlatformTags,
  parseBugLinks,
} from './field-parsers';
import type { ParsedTestCase, ParsedStep } from '../validations/csv-import';

interface ColumnLookup {
  [field: string]: number;
}

function getCell(row: string[], col: ColumnLookup, field: string, fallbackIndex: number): string {
  const idx = col[field] ?? fallbackIndex;
  return row[idx]?.trim() ?? '';
}

/**
 * Core parser: converts raw CSV rows + column mappings into structured ParsedTestCase[].
 *
 * Handles the Google Sheets export format where:
 * - Header rows have a FIXED layout (suite+id, overall_status, automation, dates)
 * - Step rows follow the user-mapped column layout from the column header row
 */
export function parseTestCasesFromRows(
  rows: string[][],
  columnLookup: ColumnLookup,
): ParsedTestCase[] {
  const stepColIdx = columnLookup.step_number ?? 3;

  const testCases: ParsedTestCase[] = [];
  let currentSuite: { name: string; prefix: string } | null = null;
  let currentCase: ParsedTestCase | null = null;
  let stepNumber = 0;

  for (const row of rows) {
    const rowType = classifyRow(row, stepColIdx);

    if (rowType === 'empty' || rowType === 'column_header') continue;

    if (rowType === 'header') {
      if (currentCase && currentCase.steps.length > 0) {
        testCases.push(currentCase);
        currentCase = null;
      }

      const headerData = parseHeaderRow(row);
      if (headerData) {
        currentSuite = {
          name: headerData.suiteInfo.suiteName,
          prefix: headerData.suiteInfo.prefix,
        };

        currentCase = {
          display_id: headerData.suiteInfo.displayId,
          suite_name: headerData.suiteInfo.suiteName,
          prefix: headerData.suiteInfo.prefix,
          sequence_number: headerData.suiteInfo.sequenceNumber,
          title: '',
          description: null,
          precondition: null,
          automation_status: headerData.automationStatus,
          platform_tags: [],
          overall_status_text: headerData.overallStatus,
          execution_dates: headerData.executionDates,
          steps: [],
          bug_links: [],
        };
        stepNumber = 0;
      }
      continue;
    }

    if (rowType === 'automation_only') {
      if (currentCase) {
        stepNumber++;
        const stepDesc = getCell(row, columnLookup, 'step_description', 4);
        const step: ParsedStep = {
          step_number: stepNumber,
          description: stepDesc || 'Automation Only',
          is_automation_only: true,
        };
        currentCase.steps.push(step);
      }
      continue;
    }

    if (rowType === 'first_step') {
      const displayId = getCell(row, columnLookup, 'display_id', 0);
      const description = getCell(row, columnLookup, 'description', 1);
      const precondition = getCell(row, columnLookup, 'precondition', 2);

      const isSameCaseFromHeader = currentCase && currentCase.display_id === displayId;

      if (currentCase && currentCase.steps.length > 0 && !isSameCaseFromHeader) {
        testCases.push(currentCase);
        currentCase = null;
      }

      if (isSameCaseFromHeader && currentCase) {
        currentCase.description = description || null;
        currentCase.precondition = precondition || null;
        currentCase.title = description
          ? (description.length > 200 ? description.slice(0, 200) + '...' : description)
          : `${currentCase.suite_name} ${currentCase.display_id}`;
      } else if (currentSuite) {
        if (currentCase && currentCase.steps.length > 0) {
          testCases.push(currentCase);
        }
        const match = displayId.match(/^([A-Z]{1,10})-(\d+)$/);
        currentCase = {
          display_id: displayId,
          suite_name: currentSuite.name,
          prefix: match ? match[1] : currentSuite.prefix,
          sequence_number: match ? parseInt(match[2], 10) : 0,
          title: description
            ? (description.length > 200 ? description.slice(0, 200) + '...' : description)
            : `${currentSuite.name} ${displayId}`,
          description: description || null,
          precondition: precondition || null,
          automation_status: 'not_automated',
          platform_tags: [],
          steps: [],
          bug_links: [],
        };
      }

      stepNumber = 0;
    }

    if (currentCase && (rowType === 'first_step' || rowType === 'step')) {
      const stepNumStr = getCell(row, columnLookup, 'step_number', 3);
      const parsedStepNum = parseInt(stepNumStr, 10);
      if (!isNaN(parsedStepNum)) stepNumber = parsedStepNum;
      else stepNumber++;

      const stepDesc = getCell(row, columnLookup, 'step_description', 4);
      const testData = getCell(row, columnLookup, 'test_data', 5);
      const expectedResult = getCell(row, columnLookup, 'expected_result', 6);
      const platformResultsStr = getCell(row, columnLookup, 'platform_results', 7);
      const commentsStr = getCell(row, columnLookup, 'comments', 9);
      const bugLinkStr = getCell(row, columnLookup, 'bug_link', 10);

      if (!stepDesc && !testData && !expectedResult) continue;

      const platformResults = parsePlatformResults(platformResultsStr);
      const platforms = extractPlatformTags(platformResults);
      if (platforms.length > 0) {
        const existing = new Set(currentCase.platform_tags);
        platforms.forEach((p) => existing.add(p));
        currentCase.platform_tags = [...existing];
      }

      const bugLinks = parseBugLinks(bugLinkStr);
      if (bugLinks.length > 0) {
        currentCase.bug_links = [
          ...(currentCase.bug_links ?? []),
          ...bugLinks,
        ];
      }

      const step: ParsedStep = {
        step_number: stepNumber,
        description: stepDesc || 'No description',
        test_data: testData || null,
        expected_result: expectedResult || null,
        is_automation_only: false,
        platform_results: platformResults.length > 0 ? platformResults : undefined,
        comments: commentsStr || null,
        bug_links: bugLinks.length > 0 ? bugLinks : undefined,
      };

      currentCase.steps.push(step);
    }
  }

  if (currentCase && currentCase.steps.length > 0) {
    testCases.push(currentCase);
  }

  for (const tc of testCases) {
    tc.bug_links = [...new Set(tc.bug_links ?? [])];
  }

  return testCases;
}

/**
 * Builds a column lookup from mapping entries.
 */
export function buildColumnLookupFromMappings(
  mappings: Array<{ csvIndex: number; systemField: string }>,
): ColumnLookup {
  const lookup: ColumnLookup = {};
  for (const m of mappings) {
    if (m.systemField !== 'unmapped') {
      lookup[m.systemField] = m.csvIndex;
    }
  }
  return lookup;
}
