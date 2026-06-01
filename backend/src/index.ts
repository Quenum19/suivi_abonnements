import { env } from './env.js';
import { createApp } from './app.js';
import { startScheduler } from './scheduler.js';
import { prisma } from './db.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 API prête sur http://localhost:${env.PORT} (${env.NODE_ENV})`);
  startScheduler();
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
