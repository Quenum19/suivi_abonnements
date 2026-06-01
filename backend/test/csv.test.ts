import { describe, it, expect } from 'vitest';
import { toCsv, parseCsv, CSV_COLUMNS } from '../src/lib/csv.js';

describe('CSV', () => {
  it('sérialise puis reparse sans perte (round-trip)', () => {
    const rows = [
      {
        name: 'CapCut',
        category: 'Vidéo',
        startDate: '2026-05-29',
        expiryDate: '2027-05-29',
        amount: '',
        currency: '',
        notes: 'Abonnement annuel.',
      },
      {
        name: 'Avec, virgule et "guillemets"',
        category: 'Test',
        startDate: '',
        expiryDate: '2027-01-01',
        amount: '59.88',
        currency: 'USD',
        notes: 'Ligne1\nLigne2',
      },
    ];
    const csv = toCsv(rows);
    const parsed = parseCsv(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe('CapCut');
    expect(parsed[1].name).toBe('Avec, virgule et "guillemets"');
    expect(parsed[1].notes).toBe('Ligne1\nLigne2');
    expect(parsed[1].currency).toBe('USD');
  });

  it('expose les colonnes attendues en en-tête', () => {
    const csv = toCsv([]);
    expect(csv.startsWith(CSV_COLUMNS.join(','))).toBe(true);
  });
});
