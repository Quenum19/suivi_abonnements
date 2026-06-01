import { Router } from 'express';
import { prisma } from '../db.js';
import { computeInsights } from '../services/insights.js';
import { asyncHandler } from '../lib/http.js';

export const insightsRouter = Router();

// GET /api/insights — couche « Économies » (totaux, doublons, inutilisés, à couper).
insightsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const subs = await prisma.subscription.findMany({
      where: { organizationId: req.auth!.organizationId },
    });
    res.json({ data: computeInsights(subs) });
  }),
);
