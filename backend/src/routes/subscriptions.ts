import { Router } from 'express';
import { prisma } from '../db.js';
import { serializeSubscription } from '../lib/serialize.js';
import { createSubscriptionSchema, updateSubscriptionSchema } from '../schemas.js';
import { asyncHandler, HttpError } from '../lib/http.js';
import { assertWithinQuota } from '../services/billing.js';

export const subscriptionsRouter = Router();

// GET /api/subscriptions?search=&category=
subscriptionsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const orgId = req.auth!.organizationId;
    const search = (req.query.search as string | undefined)?.trim();
    const category = (req.query.category as string | undefined)?.trim();

    const subs = await prisma.subscription.findMany({
      where: {
        organizationId: orgId,
        ...(category ? { category } : {}),
        ...(search ? { name: { contains: search } } : {}),
      },
      orderBy: [{ category: 'asc' }, { expiryDate: 'asc' }],
    });

    const now = new Date();
    res.json({ data: subs.map((s) => serializeSubscription(s, now)) });
  }),
);

// GET /api/subscriptions/:id
subscriptionsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const sub = await prisma.subscription.findFirst({
      where: { id: req.params.id, organizationId: req.auth!.organizationId },
    });
    if (!sub) throw new HttpError(404, 'Abonnement introuvable');
    res.json({ data: serializeSubscription(sub) });
  }),
);

// POST /api/subscriptions
subscriptionsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const orgId = req.auth!.organizationId;
    const input = createSubscriptionSchema.parse(req.body);
    await assertWithinQuota(orgId);
    const sub = await prisma.subscription.create({ data: { ...input, organizationId: orgId } });
    res.status(201).json({ data: serializeSubscription(sub) });
  }),
);

// PUT /api/subscriptions/:id
subscriptionsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const orgId = req.auth!.organizationId;
    const input = updateSubscriptionSchema.parse(req.body);
    const existing = await prisma.subscription.findFirst({
      where: { id: req.params.id, organizationId: orgId },
    });
    if (!existing) throw new HttpError(404, 'Abonnement introuvable');
    const sub = await prisma.subscription.update({ where: { id: req.params.id }, data: input });
    res.json({ data: serializeSubscription(sub) });
  }),
);

// DELETE /api/subscriptions/:id
subscriptionsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const orgId = req.auth!.organizationId;
    const existing = await prisma.subscription.findFirst({
      where: { id: req.params.id, organizationId: orgId },
    });
    if (!existing) throw new HttpError(404, 'Abonnement introuvable');
    await prisma.subscription.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);
