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

describe('Gestion d’équipe', () => {
  it('le quota du plan free bloque l’invitation (1 membre max)', async () => {
    const { agent } = await register('owner@team.test');
    const res = await agent.post('/api/team/invite').send({ email: 'x@team.test', role: 'member' });
    expect(res.status).toBe(402);
  });

  it('invite, liste, change le rôle puis retire un membre (plan pro)', async () => {
    const { agent, body } = await register('owner@team.test');
    await prisma.organization.update({ where: { id: body.organization.id }, data: { plan: 'pro' } });

    const inv = await agent.post('/api/team/invite').send({ email: 'collab@team.test', role: 'member' });
    expect(inv.status).toBe(201);
    expect(inv.body.data.temporaryPassword).toBeTruthy();

    const list = await agent.get('/api/team');
    expect(list.body.data).toHaveLength(2);

    // Le membre invité peut se connecter avec le mot de passe temporaire.
    const collab = request.agent(app);
    const login = await collab
      .post('/api/auth/login')
      .send({ email: 'collab@team.test', password: inv.body.data.temporaryPassword });
    expect(login.status).toBe(200);

    const member = list.body.data.find((m: { email: string }) => m.email === 'collab@team.test');
    const up = await agent.patch(`/api/team/${member.userId}`).send({ role: 'admin' });
    expect(up.status).toBe(200);

    const del = await agent.delete(`/api/team/${member.userId}`);
    expect(del.status).toBe(204);
    expect((await agent.get('/api/team')).body.data).toHaveLength(1);
  });

  it('un membre ne peut pas se retirer lui-même', async () => {
    const { agent, body } = await register('owner@team.test');
    const me = body.user.id;
    const res = await agent.delete(`/api/team/${me}`);
    expect(res.status).toBe(400);
  });
});

describe('Changement de mot de passe', () => {
  it('refuse un mauvais mot de passe actuel puis accepte le bon', async () => {
    const { agent } = await register('pw@user.test');
    const bad = await agent
      .post('/api/auth/password')
      .send({ currentPassword: 'wrong', newPassword: 'newpassword123' });
    expect(bad.status).toBe(401);

    const ok = await agent
      .post('/api/auth/password')
      .send({ currentPassword: 'password123', newPassword: 'newpassword123' });
    expect(ok.status).toBe(200);

    const relog = request.agent(app);
    const login = await relog
      .post('/api/auth/login')
      .send({ email: 'pw@user.test', password: 'newpassword123' });
    expect(login.status).toBe(200);
  });
});
