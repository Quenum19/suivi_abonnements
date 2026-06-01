import { Router } from 'express';
import { prisma } from '../db.js';
import { computeInsights } from '../services/insights.js';
import { asyncHandler } from '../lib/http.js';

export const insightsRouter = Router();

// GET /api/insights — couche « Économies » (totaux, doublons, inutilisés, à couper).
insightsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const subs = await prisma.subscription.findMany();
    res.json({ data: computeInsights(subs) });
  }),
);
