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
import { inboundRouter } from './routes/inbound.js';
import { billingRouter, stripeWebhookHandler } from './routes/billing.js';
import { organizationRouter } from './routes/organization.js';
import { teamRouter } from './routes/team.js';
import { notificationsRouter } from './routes/notifications.js';
import { adminRouter } from './routes/admin.js';
import { requireSuperAdmin } from './middleware/admin.js';

export function createApp(): Express {
  const app = express();

  // CSP désactivée : le SPA charge Google Fonts + styles inline. Les autres
  // en-têtes de sécurité de helmet restent actifs.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ credentials: true, origin: true }));
  app.use(cookieParser());

  // Webhook Stripe : corps BRUT requis pour vérifier la signature → AVANT json().
  app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
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

  // Import de facture par email/webhook entrant (public via jeton d'org).
  app.use('/api/inbound', inboundRouter);

  // Flux calendrier ICS — public via jeton d'organisation (/api/calendar/:token.ics).
  app.use('/api/calendar', calendarRouter);

  // Routes protégées (scopées à l'organisation de la session)
  app.use('/api/subscriptions', requireAuth, subscriptionsRouter);
  app.use('/api/reminders', requireAuth, remindersRouter);
  app.use('/api/insights', requireAuth, insightsRouter);
  app.use('/api/billing', requireAuth, billingRouter);
  app.use('/api/organization', requireAuth, organizationRouter);
  app.use('/api/team', requireAuth, teamRouter);
  app.use('/api/notifications', requireAuth, notificationsRouter);
  app.use('/api/admin', requireAuth, requireSuperAdmin, adminRouter);
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
