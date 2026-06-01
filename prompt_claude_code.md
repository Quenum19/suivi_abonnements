# Prompt Claude Code — Application de suivi des échéances d'abonnements

> Colle tout ce qui suit dans Claude Code, à la racine d'un dossier vide.
> Tu peux aussi déposer le fichier `suivi_abonnements.html` dans ce dossier : il sert de référence de design et de logique métier.

---

## Rôle et objectif

Tu es un ingénieur full-stack senior. Construis une **application web hébergeable de suivi des échéances d'abonnements** qui remplace un prototype HTML mono-fichier existant (`suivi_abonnements.html`, fourni comme référence de design et de logique). L'app doit permettre de visualiser, gérer et **être rappelé automatiquement** des dates de renouvellement de comptes/services.

Avant d'écrire du code : **présente d'abord un plan** (architecture, stack, structure de fichiers, étapes). Attends ma validation, puis exécute étape par étape en commitant à chaque palier fonctionnel.

## Contexte métier

L'utilisateur suit des abonnements répartis par catégorie. Chaque abonnement a une date de début, une date d'échéance, un montant facultatif et des notes. L'écran principal doit montrer, pour chaque abonnement, le **nombre de jours restants** avant l'échéance, avec un statut coloré :
- vert « À jour » : > 60 jours
- orange « À surveiller » : ≤ 60 jours
- rouge « Bientôt / Expiré » : ≤ 30 jours ou date dépassée

## Stack souhaitée

- **Frontend** : React + Vite + TypeScript, Tailwind CSS.
- **Backend** : Node.js (Express ou Fastify) + TypeScript, ou Next.js (app router) si tu préfères un mono-repo. Justifie ton choix.
- **Base de données** : SQLite via Prisma pour démarrer (migrable vers PostgreSQL sans réécriture).
- **Auth** : simple au départ — une seule clé/utilisateur via variable d'environnement (`APP_PASSWORD`), pas de système multi-comptes pour le MVP.
- **Conteneurisation** : `Dockerfile` + `docker-compose.yml` pour un déploiement en une commande.
- Aucune dépendance payante.

## Fonctionnalités

### MVP
1. CRUD complet sur les abonnements (créer, lister, modifier, supprimer) via une API REST documentée.
2. Calcul des jours restants côté serveur **et** côté client (cohérents), basé sur la date du jour.
3. Regroupement et tri par catégorie ; tri secondaire par jours restants croissants.
4. Tableau de bord : nombre total d'abonnements, prochaine échéance, nombre d'abonnements à surveiller (≤ 60 j).
5. Recherche/filtre par nom et par catégorie.
6. Gestion du montant en plusieurs devises (au moins USD, EUR, XOF) avec affichage du total mensuel/annuel estimé par devise.

### Rappels automatiques (point central, à ne pas négliger)
7. Un **planificateur** (cron interne, ex. `node-cron`) qui s'exécute chaque jour et détecte les abonnements arrivant à échéance dans X jours (X configurable, ex. 30, 7, 1).
8. À chaque détection, envoyer une notification via **deux canaux interchangeables** définis par config :
   - **Email** (SMTP via Nodemailer), et/ou
   - **Webhook n8n** : POST JSON vers une URL `N8N_WEBHOOK_URL` configurable, payload `{ name, category, expiry, daysLeft, amount }`. C'est ce canal qui permettra à l'utilisateur de router le rappel vers email/WhatsApp/agenda dans n8n.
9. Idempotence : ne pas renvoyer plusieurs fois le même rappel pour le même seuil (table `reminders_sent`).
10. Endpoint manuel `POST /api/reminders/run` pour déclencher le check à la demande (utile en test).

### Confort
11. Export/import des données en JSON et CSV.
12. Variable d'env pour les seuils de rappel, le fuseau horaire, et l'activation de chaque canal.

## Modèle de données

```
Subscription {
  id          string (cuid)
  name        string
  category    string
  startDate   date | null
  expiryDate  date            // requis
  amount      decimal | null
  currency    string | null   // "USD" | "EUR" | "XOF" | ...
  notes       string | null
  createdAt   datetime
  updatedAt   datetime
}

ReminderSent {
  id             string
  subscriptionId string  (FK)
  thresholdDays  int      // 30, 7, 1...
  sentAt         datetime
  channel        string   // "email" | "n8n"
}
```

## Données initiales (seed)

```json
[
  { "name": "CapCut", "category": "Création de contenu vidéo", "startDate": "2026-05-29", "expiryDate": "2027-05-29", "amount": null, "currency": null, "notes": "Abonnement annuel." },
  { "name": "Opusclip", "category": "Création de contenu vidéo", "startDate": "2026-05-09", "expiryDate": "2027-06-29", "amount": null, "currency": null, "notes": "À vérifier : avec 1 mois, l'échéance serait plutôt le 09/06/2026." },
  { "name": "Business Web Hosting", "category": "Hébergement web", "startDate": "2026-04-01", "expiryDate": "2027-07-01", "amount": 59.88, "currency": "USD", "notes": "Hébergement du site newinechurch.org." }
]
```

## Direction de design (reprends l'esprit du prototype)

- Thème clair, calme, « tableau de bord premium » : fond crème (`#F7F3EC`), encre `#1B1A17`, accent vert profond `#1F4D46`.
- Couleurs de statut : vert `#2E7D52`, orange `#B5791C`, rouge `#B23A2E`.
- Police d'affichage à caractère (sérif, ex. Fraunces) pour les titres et le grand nombre de jours restants ; police de corps lisible (ex. DM Sans).
- Cartes avec bordure gauche colorée selon le statut, barre de progression du temps écoulé, badge de statut.
- Entièrement responsive (mobile d'abord).
- Interface en **français**.

## Contraintes techniques

- TypeScript strict, ESLint + Prettier configurés.
- Variables sensibles uniquement via `.env` (fournis un `.env.example`). Ne jamais committer de secret.
- Validation des entrées API (zod).
- Gestion d'erreurs propre et messages clairs.
- Aucune donnée bancaire ou identifiant stocké en clair ; le montant est une simple valeur de suivi, pas un moyen de paiement.

## Livrables attendus

- Code source structuré (`/frontend`, `/backend` ou structure Next.js justifiée).
- `README.md` : installation, lancement en dev, build, déploiement Docker, configuration des rappels et du webhook n8n.
- `Dockerfile` + `docker-compose.yml` lançant l'app + la base.
- Migrations Prisma + script de seed.
- `.env.example` documenté.
- Tests : au minimum la logique de calcul de jours/statut et le déclenchement des rappels (Vitest/Jest).

## Critères d'acceptation

1. `docker compose up` démarre l'app accessible sur un port local, base seedée avec les 3 abonnements.
2. Je peux créer/modifier/supprimer un abonnement depuis l'UI, les changements persistent après redémarrage.
3. Le tableau de bord et les jours restants sont corrects par rapport à la date du jour.
4. En réglant un seuil et une `N8N_WEBHOOK_URL` de test (ex. webhook.site), `POST /api/reminders/run` envoie bien le payload attendu, une seule fois par seuil.
5. L'UI respecte la direction de design ci-dessus et reste lisible sur mobile.

## Méthode de travail

1. Propose le plan et la structure de fichiers, attends ma validation.
2. Implémente backend + modèle + seed, puis l'UI, puis le planificateur/rappels en dernier.
3. Commits atomiques avec messages clairs.
4. À la fin, fournis les commandes exactes pour tester chaque critère d'acceptation.
5. Signale tout choix d'architecture non trivial et toute hypothèse que tu prends.
