import { prisma } from './db.js';
import { hashPassword } from './lib/auth.js';

// Compte de démonstration (modifiable via variables d'env au besoin).
const DEMO_EMAIL = process.env.SEED_EMAIL || 'demo@local.test';
const DEMO_PASSWORD = process.env.SEED_PASSWORD || 'password123';
const DEMO_ORG = process.env.SEED_ORG || 'Mon espace';

const SEED = [
  {
    name: 'CapCut',
    category: 'Création de contenu vidéo',
    startDate: '2026-05-29',
    expiryDate: '2027-05-29',
    amount: null as number | null,
    currency: null as string | null,
    frequency: 'yearly',
    notes: 'Abonnement annuel.',
  },
  {
    name: 'Opusclip',
    category: 'Création de contenu vidéo',
    startDate: '2026-05-09',
    expiryDate: '2027-06-29',
    amount: null as number | null,
    currency: null as string | null,
    frequency: 'yearly',
    notes: "À vérifier : avec 1 mois, l'échéance serait plutôt le 09/06/2026.",
  },
  {
    name: 'Business Web Hosting',
    category: 'Hébergement web',
    startDate: '2026-04-01',
    expiryDate: '2027-07-01',
    amount: 59.88,
    currency: 'USD',
    frequency: 'yearly',
    notes: 'Hébergement du site newinechurch.org.',
  },
];

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    console.log(`Seed ignoré : le compte ${DEMO_EMAIL} existe déjà.`);
    return;
  }

  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash: await hashPassword(DEMO_PASSWORD),
      name: 'Démo',
      memberships: {
        create: { role: 'owner', organization: { create: { name: DEMO_ORG } } },
      },
    },
    include: { memberships: true },
  });
  const organizationId = user.memberships[0].organizationId;

  for (const s of SEED) {
    await prisma.subscription.create({
      data: {
        organizationId,
        name: s.name,
        category: s.category,
        startDate: s.startDate ? new Date(s.startDate) : null,
        expiryDate: new Date(s.expiryDate),
        amount: s.amount,
        currency: s.currency,
        frequency: s.frequency,
        notes: s.notes,
      },
    });
  }
  console.log(
    `Seed terminé : compte ${DEMO_EMAIL} / ${DEMO_PASSWORD} (org « ${DEMO_ORG} ») + ${SEED.length} abonnements.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
