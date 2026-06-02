import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Charge le .env de façon fiable quel que soit le cwd : d'abord la racine du
// monorepo, puis un éventuel .env propre au backend (sans écraser les variables
// déjà définies — utile en Docker où tout vient de l'environnement).
const here = path.dirname(fileURLToPath(import.meta.url)); // backend/src (dev) ou backend/dist (prod)
dotenv.config({ path: path.resolve(here, '../../.env') }); // racine du monorepo
dotenv.config({ path: path.resolve(here, '../.env') }); // backend/.env (optionnel)

/** Validation stricte de l'environnement au démarrage (fail-fast). */
const boolish = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v == null || v === '' ? def : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  TZ: z.string().default('UTC'),
  DATABASE_URL: z.string().min(1).default('file:./prisma/dev.db'),

  APP_PASSWORD: z.string().optional().default(''),
  // Secret de signature des JWT de session. EN PROD : valeur longue et aléatoire.
  JWT_SECRET: z.string().optional().default('dev-insecure-secret-change-me'),
  // true derrière HTTPS (cookie Secure). false en dev local (http).
  COOKIE_SECURE: boolish(false),

  REMINDER_THRESHOLDS: z
    .string()
    .default('30,7,1')
    .transform((s) =>
      s
        .split(',')
        .map((n) => parseInt(n.trim(), 10))
        .filter((n) => Number.isFinite(n) && n >= 0),
    ),
  REMINDER_CRON: z.string().default('0 8 * * *'),
  SCHEDULER_ENABLED: boolish(true),

  EMAIL_ENABLED: boolish(false),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: boolish(false),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  EMAIL_FROM: z.string().optional().default('Suivi abonnements <noreply@example.com>'),
  EMAIL_TO: z.string().optional().default(''),

  N8N_ENABLED: boolish(false),
  N8N_WEBHOOK_URL: z.string().optional().default(''),

  // Numéro WhatsApp par défaut (au format international, ex. +2250700000000)
  // transmis dans le payload n8n pour router le rappel vers WhatsApp.
  WHATSAPP_TO: z.string().optional().default(''),

  // ── Facturation ──
  APP_URL: z.string().optional().default('http://localhost:4000'),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  STRIPE_PRICE_PRO: z.string().optional().default(''),
  STRIPE_PRICE_TEAM: z.string().optional().default(''),
  // Active l'activation manuelle d'un plan (confirmation paiement Mobile Money,
  // virement, etc.) par un owner. Off par défaut.
  BILLING_ALLOW_MANUAL: boolish(false),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Configuration .env invalide :', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
