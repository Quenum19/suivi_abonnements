import type { Subscription } from '@prisma/client';
import { daysLeft, progressPct, statusLabel, statusOf } from './dates.js';

const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Représentation API d'un abonnement, enrichie des champs calculés serveur. */
export function serializeSubscription(s: Subscription, now = new Date()) {
  const dl = daysLeft(s.expiryDate, now);
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    startDate: isoDay(s.startDate),
    expiryDate: isoDay(s.expiryDate),
    amount: s.amount,
    currency: s.currency,
    notes: s.notes,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    // Champs calculés (cohérents avec le client) :
    daysLeft: dl,
    status: statusOf(dl),
    statusLabel: statusLabel(dl),
    progress: Math.round(progressPct(s.startDate, s.expiryDate, now)),
  };
}
