import type { AutomationStatus, ExecutionStatus, Platform } from '@/types/database';
import { HEADER_ROW_POSITIONS } from './classifier';

export interface PlatformResult {
  platform: Platform;
  status: ExecutionStatus;
}

const PLATFORM_MAP: Record<string, Platform> = {
  desktop: 'desktop',
  tablet: 'tablet',
  mobile: 'mobile',
};

const STATUS_MAP: Record<string, ExecutionStatus> = {
  pass: 'pass',
  fail: 'fail',
  blocked: 'blocked',
  skip: 'skip',
  'not run': 'not_run',
};

/**
 * Parses "Pass Tablet, Pass Desktop, Fail Mobile" into per-platform results.
 * Also handles "Pass Desktop, Pass Mobile, Pass Tablet" ordering variants.
 */
export function parsePlatformResults(value: string): PlatformResult[] {
  if (!value || !value.trim()) return [];

  const results: PlatformResult[] = [];
  const parts = value.split(',').map((p) => p.trim());

  for (const part of parts) {
    if (!part) continue;
    const words = part.split(/\s+/);
    if (words.length < 2) continue;

    const statusWord = words[0].toLowerCase();
    const platformWord = words.slice(1).join(' ').toLowerCase();

    const status = STATUS_MAP[statusWord];
    const platform = PLATFORM_MAP[platformWord];

    if (status && platform) {
      results.push({ platform, status });
    }
  }

  return results;
}

/**
 * Extracts unique platform tags from the platform results.
 */
export function extractPlatformTags(results: PlatformResult[]): Platform[] {
  return [...new Set(results.map((r) => r.platform))];
}

const AUTOMATION_MAP: Record<string, AutomationStatus> = {
  'in cicd': 'in_cicd',
  'in ci/cd': 'in_cicd',
  scripted: 'scripted',
  'out of sync': 'out_of_sync',
};

/**
 * Maps human-readable automation status to the enum value.
 */
export function parseAutomationStatus(value: string): AutomationStatus {
  if (!value || !value.trim()) return 'not_automated';
  const normalized = value.trim().toLowerCase();
  return AUTOMATION_MAP[normalized] ?? 'not_automated';
}

export interface SuiteInfo {
  suiteName: string;
  displayId: string;
  prefix: string;
  sequenceNumber: number;
}

/**
 * Extracts suite name and display_id from a test case header row.
 * "Founder Registration SR-1" -> { suiteName: "Founder Registration", displayId: "SR-1", prefix: "SR", seq: 1 }
 */
export function parseSuiteFromHeader(headerText: string): SuiteInfo | null {
  const trimmed = headerText.trim();
  const match = trimmed.match(/^(.+)\s+([A-Z]{1,10})-(\d+)$/);
  if (!match) return null;

  return {
    suiteName: match[1].trim(),
    displayId: `${match[2]}-${match[3]}`,
    prefix: match[2],
    sequenceNumber: parseInt(match[3], 10),
  };
}

/**
 * Extracts URLs from the bug report column.
 */
export function parseBugLinks(value: string): string[] {
  if (!value || !value.trim()) return [];
  const urlRegex = /https?:\/\/[^\s,]+/g;
  return value.match(urlRegex) ?? [];
}

/**
 * Detects the provider from a bug link URL.
 */
export function detectProvider(url: string): string {
  if (url.includes('gitlab.com')) return 'gitlab';
  if (url.includes('github.com')) return 'github';
  if (url.includes('jira') || url.includes('atlassian.net')) return 'jira';
  return 'other';
}

/**
 * Extracts execution dates from the header cell.
 * "Execution start date: 01/03\nExecution completion: 01/05"
 */
export function parseExecutionDates(
  value: string,
): { startDate: string | null; completionDate: string | null } {
  if (!value) return { startDate: null, completionDate: null };

  let startDate: string | null = null;
  let completionDate: string | null = null;

  const startMatch = value.match(/Execution\s+start\s+date:\s*(\S+)/i);
  if (startMatch) startDate = startMatch[1];

  const completionMatch = value.match(/Execution\s+completion:\s*(\S+)/i);
  if (completionMatch) completionDate = completionMatch[1];

  return { startDate, completionDate };
}

/**
 * Parses the overall status text from the header row (3rd column typically).
 * "Manual Testing Complete", "BLOCKED", etc.
 */
export function parseOverallStatus(value: string): ExecutionStatus | null {
  if (!value || !value.trim()) return null;
  const lower = value.trim().toLowerCase();
  if (lower === 'blocked') return 'blocked';
  return null;
}

export interface HeaderRowData {
  suiteInfo: SuiteInfo;
  overallStatus: string | null;
  automationStatus: AutomationStatus;
  executionDates: { startDate: string | null; completionDate: string | null };
}

/**
 * Extracts all structured data from a Google Sheets test-case HEADER row
 * using the FIXED column positions (these are structural, not user-mappable).
 */
export function parseHeaderRow(row: string[]): HeaderRowData | null {
  const suiteCell = row[HEADER_ROW_POSITIONS.SUITE_AND_ID]?.trim() ?? '';
  const suiteInfo = parseSuiteFromHeader(suiteCell);
  if (!suiteInfo) return null;

  const overallStatusRaw = row[HEADER_ROW_POSITIONS.OVERALL_STATUS]?.trim() ?? '';
  const automationRaw = row[HEADER_ROW_POSITIONS.AUTOMATION_STATUS]?.trim() ?? '';
  const datesRaw = row[HEADER_ROW_POSITIONS.EXECUTION_DATES]?.trim() ?? '';

  return {
    suiteInfo,
    overallStatus: overallStatusRaw || null,
    automationStatus: parseAutomationStatus(automationRaw),
    executionDates: parseExecutionDates(datesRaw),
  };
}
