import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
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
import { insightsRouter } from './routes/insights.js';
import { authRouter } from './routes/auth.js';

export function createApp(): Express {
  const app = express();

  // CSP désactivée : le SPA charge Google Fonts + styles inline. Les autres
  // en-têtes de sécurité de helmet restent actifs.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ credentials: true, origin: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.text({ type: 'text/csv', limit: '2mb' }));
  if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

  // Limitation de débit sur l'API (désactivée en test).
  if (env.NODE_ENV !== 'test') {
    app.use(
      '/api',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 600,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Trop de requêtes, réessayez plus tard.' },
      }),
    );
  }

  // Santé (publique)
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  // Authentification (public)
  app.use('/api/auth', authRouter);

  // Flux calendrier ICS — public via jeton d'organisation (/api/calendar/:token.ics).
  app.use('/api/calendar', calendarRouter);

  // Routes protégées (scopées à l'organisation de la session)
  app.use('/api/subscriptions', requireAuth, subscriptionsRouter);
  app.use('/api/reminders', requireAuth, remindersRouter);
  app.use('/api/insights', requireAuth, insightsRouter);
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
