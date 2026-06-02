/** Devises supportées et formatage des montants. */

export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'XOF'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

const LOCALE = 'fr-FR';

export function isSupportedCurrency(c: string | null | undefined): c is Currency {
  return !!c && (SUPPORTED_CURRENCIES as readonly string[]).includes(c);
}

export type ExchangeRates = Record<string, number>;

/** Parse le JSON de taux stocké sur l'organisation (tolérant). */
export function parseRates(json: string | null | undefined): ExchangeRates {
  if (!json) return {};
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    const out: ExchangeRates = {};
    for (const [k, v] of Object.entries(o)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) out[k.toUpperCase()] = n;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Convertit un montant vers la devise de référence.
 * `rates[C]` = valeur de 1 unité de C en devise de référence ; la devise de
 * référence vaut 1. Renvoie null si le taux est inconnu (non convertible).
 */
export function convert(
  amount: number,
  from: string | null | undefined,
  base: string,
  rates: ExchangeRates,
): number | null {
  const cur = (from || base).toUpperCase();
  if (cur === base.toUpperCase()) return amount;
  const rate = rates[cur];
  if (!rate) return null;
  return amount * rate;
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
