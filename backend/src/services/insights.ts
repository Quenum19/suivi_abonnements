import { annualCost, monthlyCost } from '../lib/cost.js';
import { daysLeft } from '../lib/dates.js';

/** Forme minimale nécessaire au calcul (testable sans la base). */
export interface InsightInput {
  id: string;
  name: string;
  category: string;
  amount: number | null;
  currency: string | null;
  frequency: string;
  status: string; // active | unused | cancelled
  expiryDate: Date;
}

export interface CurrencyTotals {
  monthly: number;
  yearly: number;
  count: number;
}

export interface CutCandidate {
  id: string;
  name: string;
  reason: 'unused' | 'duplicate';
  currency: string;
  annualSaving: number;
}

export interface DuplicateGroup {
  key: string;
  category: string;
  items: { id: string; name: string }[];
}

export interface Insights {
  counts: { total: number; active: number; unused: number; cancelled: number };
  totalsByCurrency: Record<string, CurrencyTotals>;
  potentialAnnualSavings: Record<string, number>;
  unused: CutCandidate[];
  duplicates: DuplicateGroup[];
  cutCandidates: CutCandidate[];
  upcomingExpensive: { id: string; name: string; daysLeft: number; amount: number; currency: string }[];
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // supprime les accents
    .replace(/\s+/g, ' ')
    .trim();

const DEFAULT_CUR = 'EUR';

/**
 * Couche « Économies » : agrège les coûts par devise, repère les doublons
 * (même nom normalisé), les abonnements inutilisés, et estime les économies
 * potentielles. Coûts jamais additionnés entre devises différentes.
 */
export function computeInsights(subs: InsightInput[], now: Date = new Date()): Insights {
  const counts = { total: subs.length, active: 0, unused: 0, cancelled: 0 };
  const totalsByCurrency: Record<string, CurrencyTotals> = {};
  const potentialAnnualSavings: Record<string, number> = {};
  const unused: CutCandidate[] = [];
  const cutCandidates: CutCandidate[] = [];
  const upcomingExpensive: Insights['upcomingExpensive'] = [];

  const addSaving = (cur: string, amount: number) => {
    potentialAnnualSavings[cur] = (potentialAnnualSavings[cur] ?? 0) + amount;
  };

  for (const s of subs) {
    if (s.status === 'unused') counts.unused += 1;
    else if (s.status === 'cancelled') counts.cancelled += 1;
    else counts.active += 1;

    const cur = s.currency || DEFAULT_CUR;

    // Totaux : on compte ce qui coûte encore (actif ou inutilisé), pas l'annulé.
    if (s.amount != null && s.status !== 'cancelled') {
      const t = (totalsByCurrency[cur] ??= { monthly: 0, yearly: 0, count: 0 });
      t.monthly += monthlyCost(s.amount, s.frequency);
      t.yearly += annualCost(s.amount, s.frequency);
      t.count += 1;
    }

    // Inutilisés : économie immédiate = leur coût annuel.
    if (s.status === 'unused' && s.amount != null) {
      const saving = annualCost(s.amount, s.frequency);
      const cand: CutCandidate = { id: s.id, name: s.name, reason: 'unused', currency: cur, annualSaving: saving };
      unused.push(cand);
      cutCandidates.push(cand);
      addSaving(cur, saving);
    }

    // Renouvellements coûteux à venir (≤ 60 j) avec montant.
    const dl = daysLeft(s.expiryDate, now);
    if (dl >= 0 && dl <= 60 && s.amount != null && s.status !== 'cancelled') {
      upcomingExpensive.push({ id: s.id, name: s.name, daysLeft: dl, amount: s.amount, currency: cur });
    }
  }
  upcomingExpensive.sort((a, b) => b.amount - a.amount);

  // Doublons : même nom normalisé (hors annulés).
  const byName = new Map<string, InsightInput[]>();
  for (const s of subs) {
    if (s.status === 'cancelled') continue;
    const k = norm(s.name);
    (byName.get(k) ?? byName.set(k, []).get(k)!).push(s);
  }
  const duplicates: DuplicateGroup[] = [];
  for (const [key, items] of byName) {
    if (items.length < 2) continue;
    duplicates.push({
      key,
      category: items[0].category,
      items: items.map((i) => ({ id: i.id, name: i.name })),
    });
    // Les copies en trop (toutes sauf la moins chère) = économie potentielle.
    const priced = items
      .filter((i) => i.amount != null)
      .sort((a, b) => annualCost(a.amount!, a.frequency) - annualCost(b.amount!, b.frequency));
    for (const dup of priced.slice(1)) {
      const cur = dup.currency || DEFAULT_CUR;
      const saving = annualCost(dup.amount!, dup.frequency);
      // On évite de compter deux fois un inutilisé déjà listé.
      if (!cutCandidates.some((c) => c.id === dup.id)) {
        cutCandidates.push({ id: dup.id, name: dup.name, reason: 'duplicate', currency: cur, annualSaving: saving });
        addSaving(cur, saving);
      }
    }
  }

  return {
    counts,
    totalsByCurrency,
    potentialAnnualSavings,
    unused,
    duplicates,
    cutCandidates,
    upcomingExpensive,
  };
}
