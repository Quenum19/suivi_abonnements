import { env } from './env.js';
import { createApp } from './app.js';
import { startScheduler } from './scheduler.js';
import { verifyEmail } from './services/notifier.js';
import { prisma } from './db.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 API prête sur http://localhost:${env.PORT} (${env.NODE_ENV})`);
  startScheduler();
  // Diagnostic SMTP au démarrage (n'empêche pas le serveur de tourner).
  if (env.EMAIL_ENABLED) {
    verifyEmail()
      .then(() => console.log(`✉️  SMTP OK (${env.SMTP_HOST}:${env.SMTP_PORT}) → ${env.EMAIL_TO}`))
      .catch((e) => console.error('⚠️  SMTP non opérationnel :', e instanceof Error ? e.message : e));
  }
});

async function shutdown(signal: string) {
  console.log(`\n${signal} reçu, arrêt en cours…`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
