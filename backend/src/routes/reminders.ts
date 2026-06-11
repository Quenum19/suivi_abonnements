import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { runRemindersSchema } from '../schemas.js';
import { runReminders } from '../services/reminders.js';
import { rollAutoRenewals } from '../services/autorenew.js';
import { enabledChannels, notify, samplePayload, type Channel } from '../services/notifier.js';
import { allowedChannelsForPlan, planOf } from '../services/billing.js';
import { env } from '../env.js';
import { asyncHandler, HttpError } from '../lib/http.js';

export const remindersRouter = Router();

// GET /api/reminders/config — état des canaux et seuils.
remindersRouter.get('/config', (_req, res) => {
  res.json({
    data: {
      channels: enabledChannels(),
      thresholds: env.REMINDER_THRESHOLDS,
      cron: env.REMINDER_CRON,
      schedulerEnabled: env.SCHEDULER_ENABLED,
      timezone: env.TZ,
    },
  });
});

// POST /api/reminders/run — déclenche le check à la demande.
// body (optionnel) : { asOf?: "AAAA-MM-JJ", dryRun?: boolean }
remindersRouter.post(
  '/run',
  asyncHandler(async (req, res) => {
    const { asOf, dryRun } = runRemindersSchema.parse(req.body ?? {});
    const orgId = req.auth!.organizationId;
    if (!dryRun) await rollAutoRenewals(asOf, orgId); // renouvelle avant de rappeler
    const result = await runReminders({ asOf, dryRun, organizationId: orgId });
    res.json({ data: result });
  }),
);

// GET /api/reminders/history?limit= — journal des rappels déjà envoyés.
remindersRouter.get(
  '/history',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 100), 1), 500);
    const rows = await prisma.reminderSent.findMany({
      where: { organizationId: req.auth!.organizationId },
      orderBy: { sentAt: 'desc' },
      take: limit,
      include: { subscription: { select: { name: true, category: true } } },
    });
    res.json({
      data: rows.map((r) => ({
        id: r.id,
        subscriptionId: r.subscriptionId,
        name: r.subscription?.name ?? '(supprimé)',
        category: r.subscription?.category ?? null,
        thresholdDays: r.thresholdDays,
        channel: r.channel,
        sentAt: r.sentAt.toISOString(),
      })),
    });
  }),
);

// POST /api/reminders/test — envoie un rappel de démonstration sur un canal.
// body : { channel: "email" | "n8n" }
const testSchema = z.object({ channel: z.enum(['email', 'n8n']) });
remindersRouter.post(
  '/test',
  asyncHandler(async (req, res) => {
    const { channel } = testSchema.parse(req.body ?? {});
    if (!enabledChannels().includes(channel as Channel)) {
      throw new HttpError(400, `Canal « ${channel} » désactivé ou non configuré (voir .env).`);
    }
    const org = await prisma.organization.findUnique({
      where: { id: req.auth!.organizationId },
    });
    const plan = planOf(org?.plan ?? 'free');
    if (!allowedChannelsForPlan(plan.id, [channel as Channel]).length) {
      throw new HttpError(
        402,
        `Le canal « ${channel} » n’est pas inclus dans le plan ${plan.label}. Passe à un plan supérieur.`,
      );
    }
    try {
      // L'e-mail de test part vers l'adresse du compte connecté.
      const me = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
      await notify(channel as Channel, samplePayload(), me?.email);
      res.json({ data: { ok: true, channel, sentTo: channel === 'email' ? me?.email : undefined } });
    } catch (e) {
      throw new HttpError(502, e instanceof Error ? e.message : 'Échec de l’envoi de test.');
    }
  }),
);
