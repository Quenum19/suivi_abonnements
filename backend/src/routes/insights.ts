import { Router } from 'express';
import { prisma } from '../db.js';
import { computeInsights } from '../services/insights.js';
import { parseRates } from '../lib/currency.js';
import { asyncHandler } from '../lib/http.js';

export const insightsRouter = Router();

// GET /api/insights — couche « Économies » (totaux, doublons, inutilisés, à couper).
insightsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const orgId = req.auth!.organizationId;
    const [subs, org] = await Promise.all([
      prisma.subscription.findMany({ where: { organizationId: orgId } }),
      prisma.organization.findUnique({ where: { id: orgId } }),
    ]);
    res.json({
      data: computeInsights(subs, {
        baseCurrency: org?.baseCurrency ?? null,
        rates: parseRates(org?.exchangeRates),
      }),
    });
  }),
);
