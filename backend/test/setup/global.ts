import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Prépare une base SQLite de test isolée : crée le schéma
 * (db push --force-reset) sur prisma/test.db.
 * Le client Prisma est supposé déjà généré (npm install / CI / build) ;
 * on ne le régénère pas ici pour éviter les verrous de fichier sous Windows.
 * Exécuté une seule fois avant toute la suite (vitest globalSetup).
 */
export default function setup() {
  const dbUrl = 'file:./prisma/test.db';
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const f = path.resolve(process.cwd(), `prisma/test.db${suffix}`);
    if (fs.existsSync(f)) fs.rmSync(f);
  }
  const e = { ...process.env, DATABASE_URL: dbUrl };
  execSync('npx prisma db push --force-reset --skip-generate', { env: e, stdio: 'inherit' });
}
