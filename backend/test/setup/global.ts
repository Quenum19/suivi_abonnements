import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Prépare une base SQLite de test isolée :
 *  - génère le client Prisma,
 *  - crée le schéma (db push --force-reset) sur prisma/test.db.
 * Exécuté une seule fois avant toute la suite (vitest globalSetup).
 */
export default function setup() {
  const dbUrl = 'file:./prisma/test.db';
  const dbFile = path.resolve(process.cwd(), 'prisma/test.db');
  if (fs.existsSync(dbFile)) fs.rmSync(dbFile);

  const e = { ...process.env, DATABASE_URL: dbUrl };
  execSync('npx prisma generate', { stdio: 'inherit' });
  execSync('npx prisma db push --force-reset --skip-generate', { env: e, stdio: 'inherit' });
}
