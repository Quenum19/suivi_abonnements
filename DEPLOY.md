# Déploiement gratuit — Render + Neon (PostgreSQL)

Ce guide met l'application **en ligne gratuitement** avec des **données persistantes** :

- **Neon** héberge la base **PostgreSQL** (gratuit, persistant).
- **Render** héberge l'**application** (Docker, gratuit) et se redéploie tout seul à chaque `git push`.

> Le code reste en **SQLite en local** (rien ne change pour ton dev). La bascule vers PostgreSQL se fait **automatiquement au build Docker** (production uniquement).

Durée : ~10 minutes. Aucune carte bancaire requise.

---

## Étape A — Base de données (Neon)

1. Va sur **https://neon.tech** → **Sign up** (avec GitHub, c'est le plus rapide).
2. **Create project** (nom : `suivi-abonnements`, région la plus proche : *Europe (Frankfurt)*).
3. Une fois créé, ouvre **Connection Details** et **copie la chaîne de connexion**. Elle ressemble à :
   ```
   postgresql://USER:PASSWORD@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
   ✅ Vérifie qu'elle se termine bien par **`?sslmode=require`**. Garde-la de côté.

---

## Étape B — Application (Render)

1. Va sur **https://render.com** → **Sign up** (avec GitHub).
2. **New +** → **Blueprint**.
3. Sélectionne le dépôt **`Quenum19/suivi_abonnements`** → Render détecte le fichier **`render.yaml`**.
4. Render liste les variables à renseigner (celles marquées « sync: false »). Remplis :

   | Variable | Valeur à mettre |
   | --- | --- |
   | `DATABASE_URL` | la chaîne **Neon** copiée à l'étape A |
   | `SUPERADMIN_EMAILS` | `sioquenum75@gmail.com` (ton e-mail = accès console admin) |
   | `SMTP_USER` | `sioiniesta19@gmail.com` |
   | `SMTP_PASS` | le **mot de passe d'application Gmail** (16 caractères) |
   | `EMAIL_TO` | `sioiniesta19@gmail.com` (secours ; chaque client reçoit sur sa propre adresse) |
   | `N8N_WEBHOOK_URL` | (laisser vide) |

   Les autres (`JWT_SECRET`, `EMAIL_FROM`, seuils, etc.) sont déjà préremplies.
5. **Apply** / **Create**. Render build l'image Docker, puis au démarrage :
   - crée automatiquement les tables sur Neon (`prisma db push`),
   - lance le serveur + le planificateur de rappels.
6. Quand le statut passe à **Live**, ouvre l'URL fournie (ex. `https://suivi-abonnements.onrender.com`).

---

## Étape C — Première utilisation

1. Sur l'URL Render → **Créer un compte** avec **ton** e-mail (`sioquenum75@gmail.com`).
2. Comme cet e-mail est dans `SUPERADMIN_EMAILS`, tu vois le bouton **★ Admin** (console plateforme).
3. Ajoute des abonnements, invite ton équipe, etc. **Les données sont conservées** (Neon).

> La connexion (cookies) est en **HTTPS sécurisé** : `COOKIE_SECURE=true` est déjà réglé.

---

## Mises à jour

À chaque `git push` sur `main`, **Render redéploie automatiquement** (option `autoDeploy: true`). Le schéma se met à jour tout seul (`prisma db push`).

---

## Bon à savoir (offre gratuite)

- **Mise en veille** : sur le plan gratuit Render, le service s'endort après ~15 min d'inactivité. La 1ʳᵉ requête suivante prend ~30 s (réveil). Les **données ne sont pas perdues** (elles sont sur Neon).
- **Rappels planifiés** : le cron tourne quand le service est éveillé. Si tu veux des rappels fiables même la nuit, un petit « ping » régulier (ex. cron-job.org sur `/api/health`) maintient le service éveillé — ou passe à un plan payant.
- **Gmail** : le `SMTP_PASS` est un **mot de passe d'application** (https://myaccount.google.com/apppasswords), pas ton mot de passe Gmail.
- **n8n / WhatsApp** : pour activer, mets `N8N_ENABLED=true` et une `N8N_WEBHOOK_URL` dans Render → Environment.

---

## Dépannage

| Symptôme | Cause / solution |
| --- | --- |
| Build échoue sur Prisma | Vérifie que `DATABASE_URL` est bien une URL **PostgreSQL** Neon avec `?sslmode=require`. |
| « Can't reach database » | URL Neon incorrecte, ou projet Neon en veille — rouvre le dashboard Neon une fois. |
| Pas d'e-mail reçu | `SMTP_PASS` = mot de passe d'application Gmail ; vérifie aussi le dossier Spam. Chaque org reçoit sur l'e-mail de son **propriétaire**. |
| Cookies / déconnexion immédiate | `COOKIE_SECURE=true` nécessite HTTPS (OK sur Render) ; en local garde `false`. |

---

## Alternative — base 100 % gérée par Render

Render propose aussi un PostgreSQL gratuit (90 jours). Pour l'utiliser, ajoute dans `render.yaml` un bloc `databases:` et référence-le via `fromDatabase`. Neon est conseillé car gratuit **sans limite de durée**.
