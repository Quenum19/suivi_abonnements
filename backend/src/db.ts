import { PrismaClient } from '@prisma/client';

// En test, on tait les logs : la violation UNIQUE attendue (idempotence) ne
// doit pas polluer la sortie. Sinon : warn + error.
export const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === 'test'
      ? []
      : process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
});
