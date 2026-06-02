import { Router } from 'express';
import { prisma } from '../db.js';

export const publicRouter = Router();

/**
 * GET /api/public/org/:slug — marque publique d'une organisation
 * (nom, logo, couleur) pour afficher une page de connexion personnalisée.
 * Aucune donnée sensible.
 */
publicRouter.get('/org/:slug', async (req, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { slug: req.params.slug },
      select: { name: true, logoUrl: true, brandColor: true, status: true },
    });
    if (!org || org.status === 'suspended') {
      res.status(404).json({ error: 'Organisation introuvable.' });
      return;
    }
    res.json({ data: { name: org.name, logoUrl: org.logoUrl, brandColor: org.brandColor } });
  } catch (e) {
    next(e);
  }
});
