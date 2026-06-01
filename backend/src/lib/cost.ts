/** Périodicité de facturation et conversion en coût mensuel / annuel. */

export const FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'yearly', 'one_time'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
  yearly: 'Annuel',
  one_time: 'Paiement unique',
};

// Combien de mois représente une période (one_time = non récurrent → 0).
const MONTHLY_FACTOR: Record<Frequency, number> = {
  weekly: 52 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
  one_time: 0,
};

export function isFrequency(v: unknown): v is Frequency {
  return typeof v === 'string' && (FREQUENCIES as readonly string[]).includes(v);
}

/** Coût mensuel équivalent d'un abonnement récurrent. */
export function monthlyCost(amount: number, frequency: string): number {
  const f = isFrequency(frequency) ? frequency : 'yearly';
  return amount * MONTHLY_FACTOR[f];
}

/** Coût annuel équivalent. */
export function annualCost(amount: number, frequency: string): number {
  return monthlyCost(amount, frequency) * 12;
}
