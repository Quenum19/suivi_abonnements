export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'XOF'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export function formatAmount(amount: number, currency: string | null): string {
  const cur = currency || 'EUR';
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${cur}`;
  }
}

/**
 * Périodicité estimée à partir de l'écart début→échéance, pour projeter un
 * coût mensuel / annuel. Heuristique : ~365 j ⇒ annuel, ~30 j ⇒ mensuel.
 */
export function estimateMonthly(
  amount: number,
  startDate: string | null,
  expiryDate: string,
): number {
  if (!startDate) return amount / 12; // défaut : suppose annuel
  const s = new Date(startDate).getTime();
  const e = new Date(expiryDate).getTime();
  const days = Math.max(1, Math.round((e - s) / 86_400_000));
  const months = days / 30.4375;
  return amount / Math.max(1, months);
}
