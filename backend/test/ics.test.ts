import { describe, it, expect } from 'vitest';
import { buildIcs } from '../src/lib/ics.js';

const NOW = new Date('2026-06-01T00:00:00Z');

describe('buildIcs', () => {
  const ics = buildIcs(
    [
      {
        id: 'abc',
        name: 'CapCut; Pro',
        category: 'Vidéo',
        expiryDate: new Date('2027-05-29T00:00:00Z'),
        amount: 59.88,
        currency: 'USD',
        notes: 'Ligne 1\nLigne 2',
      },
    ],
    7,
    NOW,
  );

  it('produit un calendrier valide avec un VEVENT et un VALARM', () => {
    expect(ics).toMatch(/^BEGIN:VCALENDAR/);
    expect(ics).toMatch(/END:VCALENDAR\r\n$/);
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:sub-abc@suivi-abonnements');
    expect(ics).toContain('DTSTART;VALUE=DATE:20270529');
    expect(ics).toContain('DTEND;VALUE=DATE:20270530'); // fin exclusive = lendemain
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:-P7D');
  });

  it('échappe les caractères spéciaux (; , \\n)', () => {
    expect(ics).toContain('SUMMARY:Échéance — CapCut\\; Pro');
    expect(ics).toContain('Ligne 1\\nLigne 2');
  });

  it('utilise des fins de ligne CRLF', () => {
    expect(ics.includes('\r\n')).toBe(true);
  });
});
