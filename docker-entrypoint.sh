#!/bin/sh
set -e

cd /app/backend

echo "→ Application des migrations Prisma…"
npx prisma migrate deploy

echo "→ Seed (idempotent, ignoré si déjà peuplé)…"
node dist/seed.js || true

echo "→ Démarrage du serveur…"
exec node dist/index.js
