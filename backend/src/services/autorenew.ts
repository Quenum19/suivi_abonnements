import { prisma } from '../db.js';

/** Avance une date d'une période selon la fréquence. */
function advance(date: Date, frequency: string): Date {
  const d = new Date(date);
  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    default: // yearly
      d.setFullYear(d.getFullYear() + 1);
  }
  return d;
}

/**
 * Renouvellement automatique : pour chaque abonnement `autoRenew` dont
 * l'échéance est passée, avance la date d'une (ou plusieurs) période(s) jusqu'à
 * revenir dans le futur, et **réarme les rappels** (purge reminders_sent) pour
 * le nouveau cycle. `one_time` n'est jamais renouvelé.
 */
export async function rollAutoRenewals(
  asOf: Date = new Date(),
  organizationId?: string,
): Promise<{ renewed: number }> {
  const today = new Date(asOf);
  today.setHours(0, 0, 0, 0);

  const subs = await prisma.subscription.findMany({
    where: {
      autoRenew: true,
      expiryDate: { lt: today },
      ...(organizationId ? { organizationId } : {}),
    },
  });

  let renewed = 0;
  for (const s of subs) {
    if (s.frequency === 'one_time') continue;
    let next = new Date(s.expiryDate);
    let guard = 0;
    while (next < today && guard++ < 1000) next = advance(next, s.frequency);
    await prisma.$transaction([
      prisma.subscription.update({ where: { id: s.id }, data: { expiryDate: next } }),
      prisma.reminderSent.deleteMany({ where: { subscriptionId: s.id } }),
    ]);
    renewed++;
  }
  return { renewed };
}
