import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';

const app = createApp();

beforeEach(async () => {
  await prisma.reminderSent.deleteMany({});
  await prisma.subscription.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('API /api/subscriptions', () => {
  it('crée un abonnement (201) avec champs calculés', async () => {
    const res = await request(app)
      .post('/api/subscriptions')
      .send({ name: 'Netflix', category: 'Streaming', expiryDate: '2099-01-01' });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.daysLeft).toBeGreaterThan(0);
    expect(res.body.data.status).toBe('safe');
  });

  it('refuse une entrée invalide (400) sans date d’échéance', async () => {
    const res = await request(app).post('/api/subscriptions').send({ name: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Validation/i);
  });

  it('liste, met à jour puis supprime', async () => {
    const created = await request(app)
      .post('/api/subscriptions')
      .send({ name: 'Spotify', category: 'Streaming', expiryDate: '2099-01-01' });
    const id = created.body.data.id;

    const list = await request(app).get('/api/subscriptions');
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);

    const upd = await request(app).put(`/api/subscriptions/${id}`).send({ name: 'Spotify Famille' });
    expect(upd.status).toBe(200);
    expect(upd.body.data.name).toBe('Spotify Famille');

    const del = await request(app).delete(`/api/subscriptions/${id}`);
    expect(del.status).toBe(204);

    const after = await request(app).get('/api/subscriptions');
    expect(after.body.data).toHaveLength(0);
  });

  it('404 sur un id inconnu', async () => {
    const res = await request(app).get('/api/subscriptions/inexistant');
    expect(res.status).toBe(404);
  });

  it('filtre par catégorie et recherche', async () => {
    await request(app)
      .post('/api/subscriptions')
      .send({ name: 'CapCut', category: 'Vidéo', expiryDate: '2099-01-01' });
    await request(app)
      .post('/api/subscriptions')
      .send({ name: 'Hostinger', category: 'Hébergement', expiryDate: '2099-01-01' });

    const byCat = await request(app).get('/api/subscriptions?category=Vidéo');
    expect(byCat.body.data).toHaveLength(1);
    const bySearch = await request(app).get('/api/subscriptions?search=host');
    expect(bySearch.body.data).toHaveLength(1);
    expect(bySearch.body.data[0].name).toBe('Hostinger');
  });
});

describe('API utilitaires', () => {
  it('expose la config des rappels', async () => {
    const res = await request(app).get('/api/reminders/config');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.thresholds)).toBe(true);
  });

  it('renvoie un historique (vide au départ)', async () => {
    const res = await request(app).get('/api/reminders/history');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('exporte en CSV avec en-tête', async () => {
    await request(app)
      .post('/api/subscriptions')
      .send({ name: 'CapCut', category: 'Vidéo', expiryDate: '2099-01-01' });
    const res = await request(app).get('/api/export?format=csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/csv/);
    expect(res.text).toMatch(/^name,category/);
    expect(res.text).toMatch(/CapCut/);
  });

  it('sert un flux ICS', async () => {
    await request(app)
      .post('/api/subscriptions')
      .send({ name: 'CapCut', category: 'Vidéo', expiryDate: '2099-01-01' });
    const res = await request(app).get('/api/calendar.ics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/calendar/);
    expect(res.text).toMatch(/BEGIN:VCALENDAR/);
    expect(res.text).toMatch(/SUMMARY:Échéance — CapCut/);
  });
});
