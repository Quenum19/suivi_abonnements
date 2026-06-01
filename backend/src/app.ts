import express, { type Express } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './env.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler } from './lib/http.js';
import { subscriptionsRouter } from './routes/subscriptions.js';
import { remindersRouter } from './routes/reminders.js';
import { dataioRouter } from './routes/dataio.js';
import { calendarRouter } from './routes/calendar.js';

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.text({ type: 'text/csv', limit: '2mb' }));
  if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

  // Santé (publique)
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  // Flux calendrier ICS — public (les clients d'agenda n'envoient pas d'en-tête).
  app.use('/api', calendarRouter);

  // Indique au frontend si un mot de passe est requis (sans le révéler).
  app.get('/api/auth/status', (_req, res) =>
    res.json({ data: { authRequired: Boolean(env.APP_PASSWORD) } }),
  );

  // Routes protégées
  app.use('/api/subscriptions', requireAuth, subscriptionsRouter);
  app.use('/api/reminders', requireAuth, remindersRouter);
  app.use('/api', requireAuth, dataioRouter);

  // Frontend statique (production) : sert frontend/dist si présent.
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDir = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(clientDir)) {
    app.use(express.static(clientDir));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
