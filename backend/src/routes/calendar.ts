import { Router } from 'express';
import { prisma } from '../db.js';
import { buildIcs } from '../lib/ics.js';

export const calendarRouter = Router();

/**
 * AMÉLIORATION — GET /api/calendar/:token.ics
 * Flux iCalendar des échéances d'UNE organisation, identifiée par son jeton
 * secret (calendarToken). Public (les clients d'agenda n'envoient pas d'en-tête
 * d'auth) mais opaque : l'URL fait office de clé, ne pas la partager.
 */
calendarRouter.get('/:token.ics', async (req, res, next) => {
  try {
    const token = req.params.token;
    const org = await prisma.organization.findUnique({ where: { calendarToken: token } });
    if (!org) {
      res.status(404).type('text/plain').send('Calendrier introuvable.');
      return;
    }

    const before = Number.parseInt(String(req.query.before ?? '7'), 10);
    const reminderDaysBefore = Number.isFinite(before) && before >= 0 ? before : 7;

    const subs = await prisma.subscription.findMany({
      where: { organizationId: org.id },
      orderBy: { expiryDate: 'asc' },
    });
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
