import { describe, it, expect } from 'vitest';
import { computeInsights, type InsightInput } from '../src/services/insights.js';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const base = { category: 'Test', expiryDate: d('2099-01-01') };

describe('computeInsights', () => {
  it('agrège les coûts par devise selon la fréquence', () => {
    const subs: InsightInput[] = [
      { ...base, id: '1', name: 'A', amount: 120, currency: 'EUR', frequency: 'yearly', status: 'active' },
      { ...base, id: '2', name: 'B', amount: 10, currency: 'EUR', frequency: 'monthly', status: 'active' },
      { ...base, id: '3', name: 'C', amount: 30, currency: 'USD', frequency: 'monthly', status: 'active' },
    ];
    const r = computeInsights(subs);
    expect(r.totalsByCurrency.EUR.monthly).toBeCloseTo(20, 5); // 120/12 + 10
    expect(r.totalsByCurrency.EUR.yearly).toBeCloseTo(240, 5);
    expect(r.totalsByCurrency.USD.yearly).toBeCloseTo(360, 5);
  });

  it('repère les inutilisés et chiffre l’économie annuelle', () => {
    const subs: InsightInput[] = [
      { ...base, id: '1', name: 'Outil X', amount: 50, currency: 'EUR', frequency: 'monthly', status: 'unused' },
    ];
    const r = computeInsights(subs);
    expect(r.counts.unused).toBe(1);
    expect(r.unused).toHaveLength(1);
    expect(r.potentialAnnualSavings.EUR).toBeCloseTo(600, 5);
  });

  it('détecte les doublons (même nom) et propose de couper le plus cher', () => {
    const subs: InsightInput[] = [
      { ...base, id: '1', name: 'Canva', amount: 100, currency: 'EUR', frequency: 'yearly', status: 'active' },
      { ...base, id: '2', name: 'canva', amount: 150, currency: 'EUR', frequency: 'yearly', status: 'active' },
    ];
    const r = computeInsights(subs);
    expect(r.duplicates).toHaveLength(1);
    expect(r.duplicates[0].items).toHaveLength(2);
    // On garde le moins cher (100), on coupe le plus cher (150).
    const cut = r.cutCandidates.find((c) => c.reason === 'duplicate');
    expect(cut?.id).toBe('2');
    expect(r.potentialAnnualSavings.EUR).toBeCloseTo(150, 5);
  });

  it('consolide les coûts dans la devise de référence via les taux', () => {
    const subs: InsightInput[] = [
      { ...base, id: '1', name: 'A', amount: 100, currency: 'EUR', frequency: 'yearly', status: 'active' },
      { ...base, id: '2', name: 'B', amount: 120000, currency: 'XOF', frequency: 'yearly', status: 'active' },
    ];
    const r = computeInsights(subs, { baseCurrency: 'XOF', rates: { EUR: 655.96 } });
    expect(r.baseCurrency).toBe('XOF');
    // 100 EUR * 655.96 + 120000 XOF = 185596
    expect(r.consolidated?.yearly).toBeCloseTo(185596, 0);
    expect(r.unconvertible).toBe(0);
  });

  it('compte les non convertibles quand un taux manque', () => {
    const subs: InsightInput[] = [
      { ...base, id: '1', name: 'A', amount: 10, currency: 'USD', frequency: 'monthly', status: 'active' },
    ];
    const r = computeInsights(subs, { baseCurrency: 'XOF', rates: {} });
    expect(r.unconvertible).toBe(1);
    expect(r.consolidated?.yearly).toBe(0);
  });

  it('exclut les annulés des totaux', () => {
    const subs: InsightInput[] = [
      { ...base, id: '1', name: 'Z', amount: 1200, currency: 'EUR', frequency: 'yearly', status: 'cancelled' },
    ];
    const r = computeInsights(subs);
    expect(r.totalsByCurrency.EUR).toBeUndefined();
    expect(r.counts.cancelled).toBe(1);
  });
});
