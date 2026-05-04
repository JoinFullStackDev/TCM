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
 * Strip characters illegal in Excel worksheet tab names: * ? : \ / [ ]
 * Replaces each with a space and collapses runs of spaces.
 */
export function sanitizeTabName(name: string): string {
  return name.replace(/[*?:\\/[\]]/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Truncate a suite name to fit Excel's 31-character tab name limit.
 * Sanitizes illegal tab characters first, then truncates.
 * Returns the truncated name. If truncation produces a duplicate, the
 * caller is responsible for appending a _(N) suffix.
 */
export function truncateTabName(name: string): string {
  const sanitized = sanitizeTabName(name);
  if (sanitized.length <= 31) return sanitized;
  return sanitized.slice(0, 28) + '...';
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
