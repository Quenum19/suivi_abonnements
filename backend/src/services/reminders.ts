import { prisma } from '../db.js';
import { env } from '../env.js';
import { daysLeft } from '../lib/dates.js';
import { enabledChannels, notify, type Channel, type ReminderPayload } from './notifier.js';

export interface RunOptions {
  asOf?: Date;
  dryRun?: boolean;
}

export interface SentEntry {
  subscriptionId: string;
  name: string;
  thresholdDays: number;
  channel: Channel;
  daysLeft: number;
}

export interface RunResult {
  asOf: string;
  channels: Channel[];
  thresholds: number[];
  considered: number;
  sent: SentEntry[];
  skipped: number; // déjà envoyés (idempotence)
  errors: { subscriptionId: string; channel: Channel; thresholdDays: number; error: string }[];
  dryRun: boolean;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Cœur des rappels automatiques.
 *
 * Pour chaque seuil T et chaque canal actif, on rappelle tout abonnement dont
 * l'échéance est dans 0..T jours, UNE seule fois par (abonnement, seuil, canal).
 *
 * OPTIMISATION : la requête ne ramène que les abonnements dans la fenêtre
 * [aujourd'hui ; aujourd'hui + max(seuils)] grâce à l'index sur expiryDate.
 * L'idempotence est garantie par la contrainte UNIQUE en base : on « réserve »
 * la ligne reminders_sent (create) ; un doublon lève P2002 et est ignoré. Si
 * l'envoi échoue après réservation, on libère la ligne pour réessayer plus tard.
 */
export async function runReminders(opts: RunOptions = {}): Promise<RunResult> {
  const asOf = opts.asOf ?? new Date();
  const dryRun = opts.dryRun ?? false;
  const channels = enabledChannels();
  const thresholds = [...env.REMINDER_THRESHOLDS].sort((a, b) => b - a);

  const result: RunResult = {
    asOf: isoDay(asOf),
    channels,
    thresholds,
    considered: 0,
    sent: [],
    skipped: 0,
    errors: [],
    dryRun,
  };

  if (channels.length === 0 || thresholds.length === 0) return result;

  const today = new Date(asOf);
  today.setHours(0, 0, 0, 0);
  const upper = new Date(today);
  upper.setDate(upper.getDate() + Math.max(...thresholds));
  upper.setHours(23, 59, 59, 999);

  const subs = await prisma.subscription.findMany({
    where: { expiryDate: { gte: today, lte: upper } },
    orderBy: { expiryDate: 'asc' },
  });
  result.considered = subs.length;

  for (const sub of subs) {
    const dl = daysLeft(sub.expiryDate, asOf);
    if (dl < 0) continue;

    for (const threshold of thresholds) {
      if (dl > threshold) continue;

      const payload: ReminderPayload = {
        name: sub.name,
        category: sub.category,
        expiry: isoDay(sub.expiryDate),
        daysLeft: dl,
        amount: sub.amount ?? null,
        currency: sub.currency ?? null,
        responsible: sub.responsible ?? null,
        frequency: sub.frequency,
      };

      for (const channel of channels) {
        if (dryRun) {
          const already = await prisma.reminderSent.findUnique({
            where: {
              subscriptionId_thresholdDays_channel: {
                subscriptionId: sub.id,
                thresholdDays: threshold,
                channel,
              },
            },
          });
          if (already) result.skipped += 1;
          else
            result.sent.push({
              subscriptionId: sub.id,
              name: sub.name,
              thresholdDays: threshold,
              channel,
              daysLeft: dl,
            });
          continue;
        }

        // Réservation atomique (idempotence garantie en base).
        let claimed: { id: string } | null = null;
        try {
          claimed = await prisma.reminderSent.create({
            data: { subscriptionId: sub.id, thresholdDays: threshold, channel },
            select: { id: true },
          });
        } catch (e: unknown) {
          if (isUniqueViolation(e)) {
            result.skipped += 1;
            continue; // déjà envoyé
          }
          throw e;
        }

        try {
          await notify(channel, payload);
          result.sent.push({
            subscriptionId: sub.id,
            name: sub.name,
            thresholdDays: threshold,
            channel,
            daysLeft: dl,
          });
        } catch (err) {
          // Envoi raté → on libère la réservation pour réessayer au prochain run.
          await prisma.reminderSent.delete({ where: { id: claimed.id } }).catch(() => undefined);
          result.errors.push({
            subscriptionId: sub.id,
            channel,
            thresholdDays: threshold,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  return result;
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code?: string }).code === 'P2002'
  );
}
