import { describe, it, expect } from 'vitest';
import { daysLeft, statusOf, statusLabel, progressPct } from '../src/lib/dates.js';

const NOW = new Date('2026-06-01T10:00:00Z');

describe('daysLeft', () => {
  it('compte les jours entiers jusqu’à l’échéance', () => {
    expect(daysLeft('2026-06-01', NOW)).toBe(0);
    expect(daysLeft('2026-06-02', NOW)).toBe(1);
    expect(daysLeft('2026-07-01', NOW)).toBe(30);
    expect(daysLeft('2026-08-30', NOW)).toBe(90);
  });

  it('renvoie un nombre négatif pour une date dépassée', () => {
    expect(daysLeft('2026-05-31', NOW)).toBe(-1);
    expect(daysLeft('2026-05-01', NOW)).toBe(-31);
  });
});

describe('statusOf', () => {
  it('classe correctement selon les seuils 30 / 60', () => {
    expect(statusOf(-1)).toBe('urgent'); // dépassé
    expect(statusOf(0)).toBe('urgent');
    expect(statusOf(30)).toBe('urgent'); // ≤ 30
    expect(statusOf(31)).toBe('soon');
    expect(statusOf(60)).toBe('soon'); // ≤ 60
    expect(statusOf(61)).toBe('safe'); // > 60
    expect(statusOf(365)).toBe('safe');
  });
});

describe('statusLabel', () => {
  it('donne le libellé français attendu', () => {
    expect(statusLabel(-2)).toBe('Expiré');
    expect(statusLabel(10)).toBe('Bientôt');
    expect(statusLabel(45)).toBe('À surveiller');
    expect(statusLabel(120)).toBe('À jour');
  });
});

describe('progressPct', () => {
  it('0 % au début, ~50 % à mi-parcours, 100 % à l’échéance', () => {
    expect(progressPct('2026-06-01', '2026-06-01', NOW)).toBe(100);
    expect(progressPct('2026-05-01', '2026-07-01', new Date('2026-06-01'))).toBeCloseTo(50.8, 0);
    expect(progressPct(null, '2027-01-01', NOW)).toBe(0);
  });
});
