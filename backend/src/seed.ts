import { prisma } from './db.js';

// Données initiales fournies dans le cahier des charges.
const SEED = [
  {
    name: 'CapCut',
    category: 'Création de contenu vidéo',
    startDate: '2026-05-29',
    expiryDate: '2027-05-29',
    amount: null as number | null,
    currency: null as string | null,
    notes: 'Abonnement annuel.',
  },
  {
    name: 'Opusclip',
    category: 'Création de contenu vidéo',
    startDate: '2026-05-09',
    expiryDate: '2027-06-29',
    amount: null as number | null,
    currency: null as string | null,
    notes: "À vérifier : avec 1 mois, l'échéance serait plutôt le 09/06/2026.",
  },
  {
    name: 'Business Web Hosting',
    category: 'Hébergement web',
    startDate: '2026-04-01',
    expiryDate: '2027-07-01',
    amount: 59.88,
    currency: 'USD',
    notes: 'Hébergement du site newinechurch.org.',
  },
];

async function main() {
  const existing = await prisma.subscription.count();
  if (existing > 0) {
    console.log(`Seed ignoré : ${existing} abonnement(s) déjà présent(s).`);
    return;
  }
  for (const s of SEED) {
    await prisma.subscription.create({
      data: {
        name: s.name,
        category: s.category,
        startDate: s.startDate ? new Date(s.startDate) : null,
        expiryDate: new Date(s.expiryDate),
        amount: s.amount,
        currency: s.currency,
        notes: s.notes,
      },
    });
  }
  console.log(`Seed terminé : ${SEED.length} abonnements créés.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
