import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/db.js';
import { rollAutoRenewals } from '../src/services/autorenew.js';

const ASOF = new Date('2026-06-02T00:00:00Z');
let orgId = '';

beforeEach(async () => {
  await prisma.reminderSent.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.organization.deleteMany({});
  orgId = (await prisma.organization.create({ data: { name: 'Auto Org' } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('rollAutoRenewals', () => {
  it('avance l’échéance passée d’une période et réarme les rappels', async () => {
    const sub = await prisma.subscription.create({
      data: {
        organizationId: orgId,
        name: 'Domaine',
        category: 'Web',
        expiryDate: new Date('2026-05-15T00:00:00Z'), // passé
        frequency: 'monthly',
        autoRenew: true,
      },
    });
    // Un rappel déjà envoyé pour l'ancien cycle.
    await prisma.reminderSent.create({
      data: { organizationId: orgId, subscriptionId: sub.id, thresholdDays: 7, channel: 'email' },
    });

    const r = await rollAutoRenewals(ASOF, orgId);
    expect(r.renewed).toBe(1);

    const updated = await prisma.subscription.findUnique({ where: { id: sub.id } });
    // 2026-05-15 + 1 mois = 2026-06-15 (dans le futur par rapport au 02/06).
    expect(updated!.expiryDate.toISOString().slice(0, 10)).toBe('2026-06-15');
    // Rappels réarmés (purgés) pour le nouveau cycle.
    expect(await prisma.reminderSent.count()).toBe(0);
  });

  it('ne touche pas les abonnements sans autoRenew ni ceux à venir', async () => {
    await prisma.subscription.create({
      data: { organizationId: orgId, name: 'A', category: 'X', expiryDate: new Date('2026-05-01T00:00:00Z'), autoRenew: false },
    });
    await prisma.subscription.create({
      data: { organizationId: orgId, name: 'B', category: 'X', expiryDate: new Date('2027-01-01T00:00:00Z'), autoRenew: true },
    });
    const r = await rollAutoRenewals(ASOF, orgId);
    expect(r.renewed).toBe(0);
  });

  it('ne renouvelle jamais un paiement unique', async () => {
    await prisma.subscription.create({
      data: { organizationId: orgId, name: 'One', category: 'X', expiryDate: new Date('2026-01-01T00:00:00Z'), frequency: 'one_time', autoRenew: true },
    });
    const r = await rollAutoRenewals(ASOF, orgId);
    expect(r.renewed).toBe(0);
  });
});
