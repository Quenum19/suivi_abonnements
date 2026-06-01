/**
 * Logique de calcul des jours restants et du statut.
 * IMPORTANT : ce fichier est volontairement identique côté frontend
 * (frontend/src/lib/dates.ts) pour garantir des résultats cohérents
 * serveur ⇄ client, comme exigé par le cahier des charges.
 */

export type Status = 'safe' | 'soon' | 'urgent';

const MS_PER_DAY = 86_400_000;

/** Ramène une date à minuit (heure locale du process). */
function atMidnight(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/**
 * Nombre de jours entiers entre aujourd'hui et la date d'échéance.
 * Positif = dans le futur, négatif = dépassé, 0 = aujourd'hui.
 * @param now injectable pour les tests (par défaut : maintenant).
 */
export function daysLeft(expiry: Date | string, now: Date = new Date()): number {
  const e = atMidnight(typeof expiry === 'string' ? new Date(expiry) : expiry);
  const today = atMidnight(now);
  return Math.round((e.getTime() - today.getTime()) / MS_PER_DAY);
}

/**
 * Statut coloré dérivé des jours restants :
 *  - urgent : dépassé OU ≤ 30 jours
 *  - soon   : ≤ 60 jours
 *  - safe   : > 60 jours
 */
export function statusOf(days: number): Status {
  if (days < 0) return 'urgent';
  if (days <= 30) return 'urgent';
  if (days <= 60) return 'soon';
  return 'safe';
}

export function statusLabel(days: number): string {
  if (days < 0) return 'Expiré';
  if (days <= 30) return 'Bientôt';
  if (days <= 60) return 'À surveiller';
  return 'À jour';
}

/** Progression du temps écoulé entre début et échéance (0–100 %). */
export function progressPct(
  start: Date | string | null | undefined,
  expiry: Date | string,
  now: Date = new Date(),
): number {
  if (!start) return 0;
  const s = atMidnight(typeof start === 'string' ? new Date(start) : start).getTime();
  const e = atMidnight(typeof expiry === 'string' ? new Date(expiry) : expiry).getTime();
  const n = atMidnight(now).getTime();
  if (e <= s) return 100;
  const p = ((n - s) / (e - s)) * 100;
  return Math.max(0, Math.min(100, p));
}
