import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';

const app = createApp();

async function register(email: string) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ email, password: 'password123' });
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

describe('Notifications in-app', () => {
  it('remonte les échéances proches et les inutilisés, triés par sévérité', async () => {
    const { agent } = await register('notif@user.test');
    const soon = new Date();
    soon.setDate(soon.getDate() + 10); // dans 10 j → urgent
    await agent.post('/api/subscriptions').send({
      name: 'Bientôt',
      category: 'X',
      expiryDate: soon.toISOString().slice(0, 10),
    });
    await agent.post('/api/subscriptions').send({
      name: 'Inutile',
      category: 'X',
      expiryDate: '2099-01-01',
      status: 'unused',
    });

    const res = await agent.get('/api/notifications');
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBeGreaterThanOrEqual(2);
    expect(res.body.data.items[0].severity).toBe('urgent'); // l'échéance proche en tête
    expect(res.body.data.items.some((i: { type: string }) => i.type === 'unused')).toBe(true);
  });

  it('aucune notification quand tout est lointain', async () => {
    const { agent } = await register('calm@user.test');
    await agent.post('/api/subscriptions').send({ name: 'Loin', category: 'X', expiryDate: '2099-01-01' });
    const res = await agent.get('/api/notifications');
    expect(res.body.data.count).toBe(0);
  });
});
