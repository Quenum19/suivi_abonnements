import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

// Mock du notifier : on capture les envois sans réseau.
const sent: { channel: string; name: string }[] = [];
vi.mock('../src/services/notifier.js', () => ({
  enabledChannels: () => ['n8n'],
  notify: vi.fn(async (channel: string, payload: { name: string }) => {
    sent.push({ channel, name: payload.name });
  }),
}));

import { prisma } from '../src/db.js';
import { runReminders } from '../src/services/reminders.js';

const ASOF = new Date('2026-06-01T08:00:00Z');
let orgId = '';

async function seed() {
  await prisma.reminderSent.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.organization.deleteMany({});
  // Plan pro : autorise le canal n8n utilisé par ces tests.
  const org = await prisma.organization.create({ data: { name: 'Test Org', plan: 'pro' } });
  orgId = org.id;
  await prisma.subscription.createMany({
    data: [
      // dans 5 j → déclenche les seuils 30 et 7 (pas 1)
      { organizationId: orgId, name: 'Bientôt', category: 'Test', expiryDate: new Date('2026-06-06T00:00:00Z') },
      // dans 90 j → aucun seuil
      { organizationId: orgId, name: 'Loin', category: 'Test', expiryDate: new Date('2026-08-30T00:00:00Z') },
      // dépassé → ignoré
      { organizationId: orgId, name: 'Expiré', category: 'Test', expiryDate: new Date('2026-05-01T00:00:00Z') },
    ],
  });
}

beforeEach(async () => {
  sent.length = 0;
  await seed();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('runReminders', () => {
  it('déclenche un rappel par seuil franchi, ignore le futur lointain et le passé', async () => {
    const r = await runReminders({ asOf: ASOF, organizationId: orgId });
    // « Bientôt » (5 j) franchit les seuils 30 et 7 → 2 envois.
    expect(r.sent).toHaveLength(2);
    expect(sent.map((s) => s.name)).toEqual(['Bientôt', 'Bientôt']);
    expect(r.sent.map((s) => s.thresholdDays).sort((a, b) => a - b)).toEqual([7, 30]);
    expect(r.errors).toHaveLength(0);
  });

  it('est idempotent : un 2ᵉ run n’envoie rien de plus (contrainte UNIQUE)', async () => {
    await runReminders({ asOf: ASOF, organizationId: orgId });
    sent.length = 0;
    const r2 = await runReminders({ asOf: ASOF, organizationId: orgId });
    expect(r2.sent).toHaveLength(0);
    expect(r2.skipped).toBe(2);
    expect(sent).toHaveLength(0);

    const rows = await prisma.reminderSent.count();
    expect(rows).toBe(2); // toujours 2, pas de doublon
  });

  it('dryRun ne persiste ni n’envoie', async () => {
    const r = await runReminders({ asOf: ASOF, dryRun: true, organizationId: orgId });
    expect(r.sent).toHaveLength(2);
    expect(sent).toHaveLength(0);
    expect(await prisma.reminderSent.count()).toBe(0);
  });
});
