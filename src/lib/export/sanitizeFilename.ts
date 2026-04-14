// Sanitize strings for use in filenames and Excel tab names

/**
 * Remove characters that are illegal in filenames on Windows/Mac/Linux.
 */
export function sanitizeForFilename(s: string): string {
  return s.replace(/[/\\:*?"<>|]/g, '_');
}

/**
 * Build a .xlsx filename: ProjectName_SuiteName_YYYY-MM-DD.xlsx
 */
export function buildFilename(
  projectName: string,
  suiteName?: string,
  date: Date = new Date(),
): string {
  const dateStr = date.toISOString().slice(0, 10);
  const parts = [
    sanitizeForFilename(projectName),
    suiteName ? sanitizeForFilename(suiteName) : null,
    dateStr,
  ].filter(Boolean);
  return `${parts.join('_')}.xlsx`;
}

/**
 * Truncate a suite name to fit Excel's 31-character tab name limit.
 * Returns the truncated name. If truncation produces a duplicate, the
 * caller is responsible for appending a _(N) suffix.
 */
export function truncateTabName(name: string): string {
  if (name.length <= 31) return name;
  return name.slice(0, 28) + '...';
}

/**
 * Given a list of tab names (possibly with duplicates after truncation),
 * return deduplicated tab names.
 */
export function deduplicateTabNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const truncated = truncateTabName(name);
    const count = seen.get(truncated) ?? 0;
    seen.set(truncated, count + 1);
    if (count === 0) return truncated;
    const suffix = `_(${count})`;
    const base = truncated.slice(0, 31 - suffix.length);
    return base + suffix;
  });
}
