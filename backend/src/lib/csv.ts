/** Sérialisation / parsing CSV minimal (compatible RFC 4180). */

export const CSV_COLUMNS = [
  'name',
  'category',
  'startDate',
  'expiryDate',
  'amount',
  'currency',
  'notes',
] as const;

function escapeCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(
  rows: Record<string, unknown>[],
  columns: readonly string[] = CSV_COLUMNS,
): string {
  const head = columns.join(',');
  const body = rows.map((r) => columns.map((c) => escapeCell(r[c])).join(',')).join('\r\n');
  return `${head}\r\n${body}\r\n`;
}

/** Parse un CSV en lignes d'objets selon l'en-tête de la 1ʳᵉ ligne. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      field = '';
      row = [];
    } else if (ch === '\r') {
      // ignoré (géré par \n)
    } else field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (nonEmpty.length < 1) return [];
  const header = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => (obj[h] = (r[idx] ?? '').trim()));
    return obj;
  });
}
