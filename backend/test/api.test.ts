import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';

const app = createApp();

// Agent authentifié (conserve le cookie de session entre les requêtes).
let agent: ReturnType<typeof request.agent>;
let calendarToken = '';

beforeEach(async () => {
  await prisma.reminderSent.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.membership.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.organization.deleteMany({});

  agent = request.agent(app);
  const reg = await agent
    .post('/api/auth/register')
    .send({ email: `t${Math.floor(performance.now())}@x.test`, password: 'password123', organizationName: 'Org Test' });
  expect(reg.status).toBe(201);
  calendarToken = reg.body.data.organization.calendarToken;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Auth', () => {
  it('refuse l’accès sans session (401)', async () => {
    const res = await request(app).get('/api/subscriptions');
    expect(res.status).toBe(401);
  });

  it('expose la session via /me', async () => {
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.organization.name).toBe('Org Test');
  });
});

describe('API /api/subscriptions (scopé organisation)', () => {
  it('crée un abonnement (201) avec champs calculés', async () => {
    const res = await agent
      .post('/api/subscriptions')
      .send({ name: 'Netflix', category: 'Streaming', expiryDate: '2099-01-01', frequency: 'monthly', amount: 10 });
    expect(res.status).toBe(201);
    expect(res.body.data.daysLeft).toBeGreaterThan(0);
    expect(res.body.data.annualCost).toBeCloseTo(120, 1);
  });

  it('refuse une entrée invalide (400)', async () => {
    const res = await agent.post('/api/subscriptions').send({ name: 'X' });
    expect(res.status).toBe(400);
  });

  it('liste, met à jour puis supprime', async () => {
    const created = await agent
      .post('/api/subscriptions')
      .send({ name: 'Spotify', category: 'Streaming', expiryDate: '2099-01-01' });
    const id = created.body.data.id;

    const list = await agent.get('/api/subscriptions');
    expect(list.body.data).toHaveLength(1);

    const upd = await agent.put(`/api/subscriptions/${id}`).send({ name: 'Spotify Famille' });
    expect(upd.body.data.name).toBe('Spotify Famille');

    const del = await agent.delete(`/api/subscriptions/${id}`);
    expect(del.status).toBe(204);
    expect((await agent.get('/api/subscriptions')).body.data).toHaveLength(0);
  });

  it('isole les données entre organisations', async () => {
    await agent.post('/api/subscriptions').send({ name: 'Privé', category: 'X', expiryDate: '2099-01-01' });

    const other = request.agent(app);
    await other
      .post('/api/auth/register')
      .send({ email: `o${Math.floor(performance.now())}@x.test`, password: 'password123' });
    const otherList = await other.get('/api/subscriptions');
    expect(otherList.body.data).toHaveLength(0); // ne voit pas les abos de l'autre org
  });
});

describe('API utilitaires', () => {
  it('insights renvoie une structure', async () => {
    const res = await agent.get('/api/insights');
    expect(res.status).toBe(200);
    expect(res.body.data.counts).toBeDefined();
  });

  it('historique vide au départ', async () => {
    const res = await agent.get('/api/reminders/history');
    expect(res.body.data).toEqual([]);
  });

  it('export CSV', async () => {
    await agent.post('/api/subscriptions').send({ name: 'CapCut', category: 'Vidéo', expiryDate: '2099-01-01' });
    const res = await agent.get('/api/export?format=csv');
    expect(res.headers['content-type']).toMatch(/csv/);
    expect(res.text).toMatch(/CapCut/);
  });

  it('flux ICS public via le jeton d’organisation', async () => {
    await agent.post('/api/subscriptions').send({ name: 'CapCut', category: 'Vidéo', expiryDate: '2099-01-01' });
    const res = await request(app).get(`/api/calendar/${calendarToken}.ics`);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/SUMMARY:Échéance — CapCut/);
  });
});
