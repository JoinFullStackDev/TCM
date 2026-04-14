// Formula injection prevention for Excel and Google Sheets export

/**
 * Prefix cell values that start with formula-trigger characters (=, +, -, @)
 * with a single quote to prevent formula injection in Excel.
 * Also strips/unescapes common HTML entities.
 */
export function guardForExcel(value: string | null | undefined): string {
  if (value == null) return '';
  const unescaped = unescapeHtml(value);
  if (/^[=+\-@]/.test(unescaped)) {
    return `'${unescaped}`;
  }
  return unescaped;
}

/**
 * For Google Sheets, use userEnteredValue.stringValue for all data cells.
 * This function just unescapes HTML entities — the caller must use stringValue, not formulaValue.
 */
export function guardForSheets(value: string | null | undefined): string {
  if (value == null) return '';
  return unescapeHtml(value);
}

/**
 * Unescape common HTML entities in a string.
 */
function unescapeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
