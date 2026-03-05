/**
 * RFC 4180-compliant CSV parser that handles quoted fields,
 * escaped quotes (""), multi-line values inside quotes, and
 * the quirks of Google Sheets CSV exports.
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        current.push(field);
        field = '';
        i++;
      } else if (ch === '\r') {
        if (i + 1 < text.length && text[i + 1] === '\n') {
          i += 2;
        } else {
          i++;
        }
        current.push(field);
        field = '';
        rows.push(current);
        current = [];
      } else if (ch === '\n') {
        current.push(field);
        field = '';
        rows.push(current);
        current = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  current.push(field);
  if (current.length > 1 || current[0] !== '') {
    rows.push(current);
  }

  return rows;
}
