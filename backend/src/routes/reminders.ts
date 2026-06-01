import { Router } from 'express';
import { runRemindersSchema } from '../schemas.js';
import { runReminders } from '../services/reminders.js';
import { enabledChannels } from '../services/notifier.js';
import { env } from '../env.js';
import { asyncHandler } from '../lib/http.js';

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
    const result = await runReminders({ asOf, dryRun });
    res.json({ data: result });
  }),
);
