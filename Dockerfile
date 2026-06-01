# ── Étape 1 : build (frontend + backend) ─────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Manifestes (cache des dépendances)
COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm install

# Sources
COPY backend ./backend
COPY frontend ./frontend

# Génère le client Prisma, build frontend puis backend
RUN npm run db:generate -w backend \
  && npm run build -w frontend \
  && npm run build -w backend

# ── Étape 2 : runtime ────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Dépendances de prod uniquement
COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/
RUN npm install --omit=dev -w backend && npm cache clean --force

# Artefacts de build
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/frontend/dist ./frontend/dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 4000
WORKDIR /app/backend
ENTRYPOINT ["/app/docker-entrypoint.sh"]
