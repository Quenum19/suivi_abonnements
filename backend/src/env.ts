import 'dotenv/config';
import { z } from 'zod';

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
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Configuration .env invalide :', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
