import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { asyncHandler, HttpError } from '../lib/http.js';
import {
  PLANS,
  type Plan,
  billingEnabled,
  createCheckoutSession,
  getStripe,
  planOf,
  setOrganizationPlan,
} from '../services/billing.js';

export const billingRouter = Router();

// GET /api/billing/plans — catalogue des plans.
billingRouter.get('/plans', (_req, res) => {
  res.json({
    data: {
      billingEnabled: billingEnabled(),
      manualEnabled: env.BILLING_ALLOW_MANUAL,
      plans: Object.values(PLANS).map((p) => ({
        id: p.id,
        label: p.label,
        maxSubscriptions: p.maxSubscriptions === Infinity ? null : p.maxSubscriptions,
        channels: p.channels,
        maxMembers: p.maxMembers === Infinity ? null : p.maxMembers,
      })),
    },
  });
});

// GET /api/billing/status — plan courant + usage de l'organisation.
billingRouter.get(
  '/status',
  asyncHandler(async (req, res) => {
    const orgId = req.auth!.organizationId;
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    const def = planOf(org?.plan ?? 'free');
    const used = await prisma.subscription.count({ where: { organizationId: orgId } });
    res.json({
      data: {
        plan: def.id,
        label: def.label,
        used,
        max: def.maxSubscriptions === Infinity ? null : def.maxSubscriptions,
        channels: def.channels,
      },
    });
  }),
);

const upgradeSchema = z.object({ plan: z.enum(['pro', 'team']) });

// POST /api/billing/checkout — démarre un paiement Stripe (plan payant).
billingRouter.post(
  '/checkout',
  asyncHandler(async (req, res) => {
    const { plan } = upgradeSchema.parse(req.body);
    const { url } = await createCheckoutSession(req.auth!.organizationId, plan as Plan);
    res.json({ data: { url } });
  }),
);

// POST /api/billing/activate — activation manuelle (Mobile Money / virement),
// réservée au owner et conditionnée par BILLING_ALLOW_MANUAL. Sert de point de
// branchement pour confirmer un paiement hors Stripe.
billingRouter.post(
  '/activate',
  asyncHandler(async (req, res) => {
    if (!env.BILLING_ALLOW_MANUAL) {
      throw new HttpError(403, 'Activation manuelle désactivée (BILLING_ALLOW_MANUAL=false).');
    }
    if (req.auth!.role !== 'owner') {
      throw new HttpError(403, 'Réservé au propriétaire de l’organisation.');
    }
    const { plan } = z.object({ plan: z.enum(['free', 'pro', 'team']) }).parse(req.body);
    await setOrganizationPlan(req.auth!.organizationId, plan as Plan);
    res.json({ data: { plan } });
  }),
);

/**
 * Webhook Stripe (monté séparément avec corps brut pour la vérification de
 * signature). Met à jour le plan de l'organisation sur abonnement payé/annulé.
 */
export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const s = getStripe();
  if (!s || !env.STRIPE_WEBHOOK_SECRET) {
    res.status(501).json({ error: 'Webhook Stripe non configuré.' });
    return;
  }
  const sig = req.header('stripe-signature') ?? '';
  let event;
  try {
    event = s.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    res.status(400).json({ error: `Signature invalide: ${e instanceof Error ? e.message : e}` });
    return;
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as { metadata?: { organizationId?: string; plan?: string } };
      const orgId = session.metadata?.organizationId;
      const plan = session.metadata?.plan as Plan | undefined;
      if (orgId && plan) await setOrganizationPlan(orgId, plan);
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as { metadata?: { organizationId?: string } };
      const orgId = sub.metadata?.organizationId;
      if (orgId) await setOrganizationPlan(orgId, 'free');
    }
    res.json({ received: true });
  } catch {
    res.status(500).json({ error: 'Traitement du webhook échoué.' });
  }
}
