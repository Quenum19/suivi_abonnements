#!/bin/sh
set -e

cd /app/backend

echo "→ Synchronisation du schéma vers la base (PostgreSQL)…"
npx prisma db push --skip-generate --accept-data-loss

# Seed optionnel (compte de démo). En production, laisser RUN_SEED non défini :
# vous créez votre propre compte via l'inscription.
if [ "$RUN_SEED" = "true" ]; then
  echo "→ Seed des données de démonstration…"
  node dist/seed.js || true
fi

echo "→ Démarrage du serveur…"
exec node dist/index.js
