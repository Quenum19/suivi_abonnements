/** Devises supportées et formatage des montants. */

export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'XOF'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

const LOCALE = 'fr-FR';

export function isSupportedCurrency(c: string | null | undefined): c is Currency {
  return !!c && (SUPPORTED_CURRENCIES as readonly string[]).includes(c);
}

export function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
