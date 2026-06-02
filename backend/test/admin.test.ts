import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';

const app = createApp();

async function registerAgent(email: string) {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ email, password: 'password123', organizationName: `Org ${email}` });
  return { agent, body: res.body.data };
}

beforeEach(async () => {
  await prisma.reminderSent.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.membership.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.organization.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Personnalisation (branding)', () => {
  it('le owner met à jour couleur + logo', async () => {
    const { agent } = await registerAgent('owner@brand.test');
    const res = await agent
      .put('/api/organization')
      .send({ brandColor: '#123ABC', logoUrl: 'https://x.test/logo.png', name: 'Ma Boîte' });
    expect(res.status).toBe(200);
    expect(res.body.data.brandColor).toBe('#123ABC');
    expect(res.body.data.name).toBe('Ma Boîte');

    const me = await agent.get('/api/auth/me');
    expect(me.body.data.organization.brandColor).toBe('#123ABC');
  });

  it('refuse une couleur invalide (400)', async () => {
    const { agent } = await registerAgent('owner2@brand.test');
    const res = await agent.put('/api/organization').send({ brandColor: 'rouge' });
    expect(res.status).toBe(400);
  });
});

describe('Espace super-admin', () => {
  it('refuse l’accès à un utilisateur normal (403)', async () => {
    const { agent } = await registerAgent('normal@user.test');
    const res = await agent.get('/api/admin/overview');
    expect(res.status).toBe(403);
  });

  it('donne la vue d’ensemble au super-admin', async () => {
    await registerAgent('normal@user.test');
    const { agent } = await registerAgent('root@admin.test'); // dans SUPERADMIN_EMAILS
    const res = await agent.get('/api/admin/overview');
    expect(res.status).toBe(200);
    expect(res.body.data.totals.organizations).toBe(2);
    expect(res.body.data.totals.users).toBe(2);
    expect(res.body.data.byPlan.free).toBe(2);
  });

  it('liste les organisations triées par nb d’abonnements', async () => {
    const { agent: a1, body: b1 } = await registerAgent('busy@user.test');
    await a1.post('/api/subscriptions').send({ name: 'A', category: 'X', expiryDate: '2099-01-01' });
    await a1.post('/api/subscriptions').send({ name: 'B', category: 'X', expiryDate: '2099-01-01' });
    await registerAgent('idle@user.test');
    const { agent } = await registerAgent('root@admin.test');

    const res = await agent.get('/api/admin/organizations?sort=subs');
    expect(res.status).toBe(200);
    expect(res.body.data[0].subscriptions).toBe(2); // le plus actif en tête
    expect(res.body.data[0].id).toBe(b1.organization.id);
  });

  it('change un plan et suspend une organisation', async () => {
    const { agent: client, body } = await registerAgent('client@user.test');
    const { agent: admin } = await registerAgent('root@admin.test');
    const orgId = body.organization.id;

    const patch = await admin
      .patch(`/api/admin/organizations/${orgId}`)
      .send({ plan: 'pro', status: 'suspended' });
    expect(patch.status).toBe(200);
    expect(patch.body.data.plan).toBe('pro');

    // L'organisation suspendue ne peut plus accéder (sa session devient invalide).
    const me = await client.get('/api/auth/me');
    expect(me.status).toBe(403);
  });
});
