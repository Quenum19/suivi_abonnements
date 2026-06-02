import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';

const app = createApp();

beforeEach(async () => {
  await prisma.membership.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.organization.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Marque publique (login personnalisé)', () => {
  it('génère un slug à l’inscription et expose la marque publique', async () => {
    const agent = request.agent(app);
    const reg = await agent
      .post('/api/auth/register')
      .send({ email: 'boss@brand.test', password: 'password123', organizationName: 'Boulangerie Awa' });
    expect(reg.body.data.organization.slug).toBe('boulangerie-awa');

    // Ajoute une marque.
    await agent.put('/api/organization').send({ brandColor: '#AA1133', logoUrl: 'https://x/l.png' });

    const pub = await request(app).get('/api/public/org/boulangerie-awa');
    expect(pub.status).toBe(200);
    expect(pub.body.data.name).toBe('Boulangerie Awa');
    expect(pub.body.data.brandColor).toBe('#AA1133');
  });

  it('404 pour un slug inconnu', async () => {
    const res = await request(app).get('/api/public/org/inconnu');
    expect(res.status).toBe(404);
  });
});
