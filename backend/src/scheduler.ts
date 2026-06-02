import cron from 'node-cron';
import { env } from './env.js';
import { runReminders } from './services/reminders.js';
import { rollAutoRenewals } from './services/autorenew.js';

let task: cron.ScheduledTask | null = null;

/** Démarre le planificateur quotidien (node-cron) si activé en config. */
export function startScheduler(): void {
  if (!env.SCHEDULER_ENABLED) {
    console.log('⏸️  Planificateur désactivé (SCHEDULER_ENABLED=false).');
    return;
  }
  if (!cron.validate(env.REMINDER_CRON)) {
    console.error(`❌ REMINDER_CRON invalide : "${env.REMINDER_CRON}". Planificateur non démarré.`);
    return;
  }

  task = cron.schedule(
    env.REMINDER_CRON,
    async () => {
      try {
        const renew = await rollAutoRenewals();
        if (renew.renewed) console.log(`🔄 Renouvellements auto : ${renew.renewed} abonnement(s).`);
        const r = await runReminders();
        console.log(
          `🔔 Rappels [${r.asOf}] : ${r.sent.length} envoyé(s), ${r.skipped} ignoré(s), ${r.errors.length} erreur(s).`,
        );
        if (r.errors.length) console.warn('   Erreurs:', r.errors);
      } catch (e) {
        console.error('❌ Échec du run de rappels planifié:', e);
      }
    },
    { timezone: env.TZ },
  );

  console.log(
    `⏰ Planificateur actif : "${env.REMINDER_CRON}" (${env.TZ}), seuils ${env.REMINDER_THRESHOLDS.join(', ')} j.`,
  );
}

export function stopScheduler(): void {
  task?.stop();
  task = null;
}
