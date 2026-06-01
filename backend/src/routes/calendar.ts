import { Router } from 'express';
import { prisma } from '../db.js';
import { buildIcs } from '../lib/ics.js';

export const calendarRouter = Router();

/**
 * AMÉLIORATION — GET /api/calendar.ics
 * Flux iCalendar de toutes les échéances. À ouvrir directement ou à utiliser
 * comme URL d'abonnement dans Google Agenda / Apple Calendar / Outlook.
 *
 * Note : volontairement NON protégé par mot de passe, car les clients
 * d'agenda n'envoient pas d'en-tête custom. L'URL fait office de jeton ;
 * ne pas la partager. (Monté en dehors du middleware d'auth, cf. app.ts.)
 */
calendarRouter.get('/calendar.ics', async (req, res, next) => {
  try {
    const before = Number.parseInt(String(req.query.before ?? '7'), 10);
    const reminderDaysBefore = Number.isFinite(before) && before >= 0 ? before : 7;

    const subs = await prisma.subscription.findMany({ orderBy: { expiryDate: 'asc' } });
    const ics = buildIcs(
      subs.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        expiryDate: s.expiryDate,
        amount: s.amount ?? null,
        currency: s.currency ?? null,
        notes: s.notes ?? null,
      })),
      reminderDaysBefore,
    );

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="abonnements.ics"');
    res.send(ics);
  } catch (e) {
    next(e);
  }
});
