# ── Étape 1 : build (frontend + backend) ─────────────────────────────
FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Manifestes (cache des dépendances)
COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm install

# Sources
COPY backend ./backend
COPY frontend ./frontend

# PRODUCTION = PostgreSQL : on bascule le provider Prisma au build.
# (Le code commité reste en SQLite pour le dev/CI local — rien ne change en local.)
RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/' backend/prisma/schema.prisma \
  && npm run db:generate -w backend \
  && npm run build -w frontend \
  && npm run build -w backend

# ── Étape 2 : runtime ────────────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates wget \
  && rm -rf /var/lib/apt/lists/*

# Dépendances de prod (prisma CLI inclus pour `db push` au démarrage)
COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/
# Le schéma (basculé en postgresql) doit être présent avant la génération du client
COPY --from=build /app/backend/prisma ./backend/prisma
RUN npm install --omit=dev -w backend \
  && npm run db:generate -w backend \
  && npm cache clean --force

# Artefacts de build
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/frontend/dist ./frontend/dist

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 4000
WORKDIR /app/backend
ENTRYPOINT ["/app/docker-entrypoint.sh"]
