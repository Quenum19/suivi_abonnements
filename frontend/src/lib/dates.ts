/**
 * Miroir EXACT de backend/src/lib/dates.ts — garantit des jours restants et
 * statuts identiques côté client et serveur (exigence du cahier des charges).
 * Sert pour l'affichage optimiste et le recalcul local entre deux fetchs.
 */

export type Status = 'safe' | 'soon' | 'urgent';

const MS_PER_DAY = 86_400_000;

function atMidnight(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function daysLeft(expiry: Date | string, now: Date = new Date()): number {
  const e = atMidnight(typeof expiry === 'string' ? new Date(expiry) : expiry);
  const today = atMidnight(now);
  return Math.round((e.getTime() - today.getTime()) / MS_PER_DAY);
}

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

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function dayCountLabel(days: number): { value: string; unit: string } {
  if (days < 0) return { value: `+${Math.abs(days)}`, unit: 'jours de retard' };
  return { value: String(days), unit: 'jours restants' };
}
