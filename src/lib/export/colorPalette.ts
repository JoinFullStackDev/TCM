// Maps suites.color_index (0-4) to ARGB hex strings for Excel/Sheets fills

export const SUITE_COLOR_PALETTE: Record<number, string> = {
  0: 'FFB8CCE4', // Light Blue
  1: 'FFC6EFCE', // Light Green
  2: 'FFFCE4D6', // Light Orange
  3: 'FFD9D2E9', // Light Purple
  4: 'FFFFEB9C', // Light Yellow
};

export const DEFAULT_COLOR = 'FFD9D9D9'; // Light Gray fallback
export const HEADER_ROW_COLOR = 'FFD9D9D9'; // Neutral gray for column header rows
export const INDEX_HEADER_COLOR = 'FF4472C4'; // Blue for Summary/Index tab headers

export function getSuiteColor(colorIndex: number): string {
  return SUITE_COLOR_PALETTE[colorIndex] ?? DEFAULT_COLOR;
}

// Convert ARGB to RGB for Google Sheets API (which uses 0-1 float RGB)
export function argbToSheetsRgb(argb: string): { red: number; green: number; blue: number } {
  const r = parseInt(argb.slice(2, 4), 16) / 255;
  const g = parseInt(argb.slice(4, 6), 16) / 255;
  const b = parseInt(argb.slice(6, 8), 16) / 255;
  return { red: r, green: g, blue: b };
}
