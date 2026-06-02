# Suivi des échéances d'abonnements

Application web de suivi des renouvellements d'abonnements, avec **rappels
automatiques** par e‑mail, webhook **n8n**, et **flux calendrier ICS**.

Remplace le prototype mono‑fichier `suivi_abonnements.html` (conservé comme
référence de design).

---

## Stack

| Couche      | Choix                                                        |
| ----------- | ----------------------------------------------------------- |
| Frontend    | React + Vite + TypeScript + Tailwind CSS                    |
| Backend     | Node.js + Express + TypeScript                              |
| Base        | SQLite via Prisma (migrable PostgreSQL sans réécriture)      |
| Planif.     | `node-cron` (check quotidien)                               |
| Rappels     | Nodemailer (SMTP) · Webhook n8n · Flux ICS                  |
| Validation  | zod · TypeScript strict · ESLint + Prettier                |
| Conteneur   | Dockerfile multi‑stage + docker-compose                    |

**Pourquoi Express plutôt que Next.js ?** La fonctionnalité centrale est un
**planificateur persistant** + un **émetteur de notifications** (SMTP / webhook).
Un process Node long‑vivant est l'hôte naturel de `node-cron` et Nodemailer ;
le frontend reste un SPA Vite simple à servir en statique. Une seule image
Docker fait tourner l'API, le cron et le frontend.

---

## Améliorations par rapport au cahier des charges

- 🟢 **Amélioration — Flux calendrier ICS** : `GET /api/calendar.ics` génère un
  calendrier iCalendar (RFC 5545) auquel on peut **s'abonner** dans Google
  Agenda / Apple Calendar / Outlook. Chaque échéance devient un événement avec
  un rappel (`VALARM`). C'est un 3ᵉ canal de rappel, sans configuration.
- ⚡ **Optimisation — Idempotence garantie en base** : la table `reminders_sent`
  porte une contrainte `UNIQUE(subscriptionId, thresholdDays, channel)`. Le
  planificateur « réserve » la ligne (`INSERT`) avant d'envoyer ; un doublon est
  rejeté par la base (P2002). Cela **supprime la course « SELECT puis INSERT »**
  et rend l'envoi sûr même en exécutions concurrentes. Un index sur `expiryDate`
  garde le scan quotidien efficace (pas de full‑scan).

### Pour aller plus loin (2ᵉ itération)

- 🕘 **Historique & test des rappels** : panneau « Historique » dans l'UI +
  `GET /api/reminders/history` (audit des envois) et `POST /api/reminders/test`
  pour vérifier la config d'un canal (email/n8n) en un clic, sans attendre le cron.
- 🔒 **Durcissement** : `helmet` (en‑têtes de sécurité) + `express-rate-limit`
  (600 req / 15 min sur `/api`).
- ✅ **Couverture de tests étendue** : **22 tests** (logique dates/statut,
  idempotence des rappels, **API end‑to‑end via supertest**, génération ICS,
  round‑trip CSV).
- 🤖 **Intégration continue** : workflow GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml))
  — lint + tests + build à chaque push/PR.

### Évolution SaaS (multi-tenant, cible PME francophones)

1. 💡 **Couche Économies** — détection des **doublons** et des abonnements
   **inutilisés**, projection coût mensuel/annuel par devise, et estimation des
   **économies potentielles** (`GET /api/insights`). Champs `frequency` et
   `status` (actif/inutilisé/annulé) sur chaque abonnement.
2. 🟢 **Rappels WhatsApp** — le payload n8n est enrichi (`responsible`,
   `whatsappTo`, `currency`, `frequency`) pour router le rappel vers WhatsApp et
   relancer le **responsable** d'un abonnement.
3. 🔐 **Multi-tenant + comptes** — `User` / `Organization` / `Membership`,
   **sessions JWT** (cookie httpOnly), **isolation des données par organisation**
   sur toutes les routes. Flux ICS par **jeton d'organisation**.
4. 🧾 **Import de factures** — parser heuristique (montant, devise, date,
   périodicité) : « coller une facture » dans l'UI (`POST /api/import/parse`) ou
   **webhook entrant** `POST /api/inbound/:token` (SendGrid/Mailgun/n8n).
5. 💳 **Plans & facturation** — plans **Free / Pro / Team**, **quotas** (nb
   d'abonnements) et **gating des canaux** par plan, **Stripe Checkout + webhook**
   (inerte sans clé) et **activation manuelle Mobile Money/virement**
   (`/api/billing/*`).

6. 🎨 **Marque blanche** — chaque entreprise choisit son **logo** et sa **couleur**
   (variables CSS dynamiques) · `PUT /api/organization`.
7. 👥 **Équipe** — invitations multi-utilisateurs avec **rôles** (owner/admin/member),
   quota de membres selon le plan, changement de mot de passe (`/api/team`,
   `/api/auth/password`).
8. ★ **Espace super-admin** (`SUPERADMIN_EMAILS`) — vue d'ensemble (orgs, users,
   abos, rappels, **MRR estimé**, activité), **graphe de croissance**, classement
   des clients, **changement de plan**, **suspension**, export CSV (`/api/admin/*`).
9. 💱 **Consolidation multi-devises** — devise de référence + taux éditables par
   organisation → **coût total unique** (ex. tout en FCFA) dans la couche Économies.
10. 🔔 **Notifications in-app** — cloche avec badge : échéances proches, abos
    inutilisés, quota de plan atteint (`/api/notifications`).
11. 🪪 **Connexion personnalisée par entreprise** — URL `/?org=<slug>` affichant
    le logo et la couleur du client (`/api/public/org/:slug`).
12. 🛡️ **Accueil & bandeau super-admin** — atterrissage direct sur la console
    plateforme + **graphique de revenus par plan** ; bandeau distinctif.
13. ↻ **Renouvellement automatique** — `autoRenew` avance l'échéance d'une période
    quand elle passe et **réarme les rappels** (scheduler + au déclenchement manuel).
14. 📄 **Export PDF** — rapport d'abonnements (`/api/report`) et rapport clients
    super-admin (`/api/admin/organizations.pdf`).

> SQLite par défaut ; **PostgreSQL** = changer `provider` + `DATABASE_URL`
> (pour la prod, ajouter la Row-Level Security par `organizationId`).
>
> **Compte de démo** créé par le seed : `demo@local.test` / `password123`
> (défini super-admin via `SUPERADMIN_EMAILS` en dev).

---

## Démarrage rapide (Docker — une commande)

```bash
cp .env.example .env        # adapte si besoin
docker compose up --build
```

L'app est sur **http://localhost:4000** (API + UI), base SQLite **seedée** avec
les 3 abonnements, données persistées dans le volume `subs-data`.

---

## Développement local (sans Docker)

Prérequis : Node ≥ 20.

```bash
npm install                 # installe backend + frontend (workspaces)
npm run db:migrate          # crée la base SQLite + applique les migrations
npm run db:seed             # insère les 3 abonnements
npm run dev                 # API (4000) + frontend (5173) en parallèle
```

- Frontend dev : http://localhost:5173 (proxy `/api` → 4000)
- API : http://localhost:4000/api

### Scripts utiles

| Commande                | Effet                                            |
| ----------------------- | ------------------------------------------------ |
| `npm run dev`           | Backend + frontend en watch                      |
| `npm run build`         | Build frontend puis backend                      |
| `npm start`             | Lance le backend compilé (sert aussi l'UI)       |
| `npm test`              | Tests backend (Vitest)                           |
| `npm run db:migrate`    | `prisma migrate deploy`                          |
| `npm run db:seed`       | Seed des données initiales                        |
| `npm run lint`          | ESLint backend + frontend                        |

---

## Configuration (`.env`)

Voir [`.env.example`](.env.example) — entièrement commenté. Points clés :

- `APP_PASSWORD` : mot de passe applicatif (en‑tête `x-app-password`). Vide = auth off.
- `REMINDER_THRESHOLDS` : seuils de rappel en jours (`30,7,1`).
- `REMINDER_CRON` / `TZ` : planning quotidien et fuseau horaire.
- `EMAIL_ENABLED` + SMTP\_\* : canal e‑mail.
- `N8N_ENABLED` + `N8N_WEBHOOK_URL` : canal webhook n8n.

> Aucun secret n'est committé. `.env` est ignoré par git.

---

## API REST

| Méthode  | Route                      | Description                                   |
| -------- | -------------------------- | --------------------------------------------- |
| GET      | `/api/health`              | Santé                                         |
| GET      | `/api/subscriptions`       | Liste (`?search=`, `?category=`) + calculs    |
| GET      | `/api/subscriptions/:id`   | Détail                                         |
| POST     | `/api/subscriptions`       | Création (zod)                                 |
| PUT      | `/api/subscriptions/:id`   | Mise à jour                                    |
| DELETE   | `/api/subscriptions/:id`   | Suppression                                    |
| GET      | `/api/reminders/config`    | Canaux / seuils / planning actifs             |
| POST     | `/api/reminders/run`       | Déclenche le check (`{ asOf?, dryRun? }`)     |
| GET      | `/api/reminders/history`   | Journal des rappels envoyés (`?limit=`)       |
| POST     | `/api/reminders/test`      | Envoie un rappel de démo (`{ channel }`)      |
| GET      | `/api/export?format=json\|csv` | Export                                    |
| POST     | `/api/import`              | Import JSON (`{ items, replace }`)            |
| POST     | `/api/import/csv`          | Import CSV                                     |
| GET      | `/api/calendar.ics`        | **Flux calendrier (amélioration)**           |

Chaque abonnement renvoyé inclut les champs calculés **serveur** `daysLeft`,
`status`, `statusLabel`, `progress` (cohérents avec le calcul client).

---

## Rappels & webhook n8n

Le check quotidien (`REMINDER_CRON`) détecte les abonnements arrivant à échéance
dans `REMINDER_THRESHOLDS` jours et notifie chaque canal **actif**, **une seule
fois** par `(abonnement, seuil, canal)`.

Payload POST vers `N8N_WEBHOOK_URL` :

```json
{ "name": "CapCut", "category": "Création de contenu vidéo", "expiry": "2027-05-29", "daysLeft": 30, "amount": null }
```

Brancher ce webhook dans n8n permet de router le rappel vers email / WhatsApp /
agenda.

---

## Tests des critères d'acceptation

```bash
# 1. Docker : app sur :4000, base seedée
docker compose up --build
curl http://localhost:4000/api/health
curl http://localhost:4000/api/subscriptions        # 3 abonnements

# 2. CRUD persistant
curl -X POST http://localhost:4000/api/subscriptions \
  -H 'content-type: application/json' \
  -d '{"name":"Test","category":"Démo","expiryDate":"2026-06-20"}'

# 3. Jours restants / dashboard cohérents (voir champ daysLeft dans la réponse)

# 4. Webhook n8n une seule fois par seuil (ex. URL de test webhook.site)
#    Mettre dans .env : N8N_ENABLED=true, N8N_WEBHOOK_URL=https://webhook.site/xxxx
curl -X POST http://localhost:4000/api/reminders/run     # envoie
curl -X POST http://localhost:4000/api/reminders/run     # n'envoie plus (skipped)

# 5. UI responsive : ouvrir http://localhost:4000 sur mobile/desktop

# Tests automatisés (logique jours/statut + idempotence des rappels)
npm test
```

---

## Modèle de données

Voir [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma).
`Subscription` (1) ──< `ReminderSent` (n), suppression en cascade.

## Passage à PostgreSQL

1. `provider = "postgresql"` dans `schema.prisma`.
2. `DATABASE_URL` Postgres dans `.env`.
3. `npm run db:migrate:dev -w backend`. Le reste du code est inchangé.
