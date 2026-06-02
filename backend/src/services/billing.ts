import Stripe from 'stripe';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { HttpError } from '../lib/http.js';
import type { Channel } from './notifier.js';

export type Plan = 'free' | 'pro' | 'team';

export interface PlanDef {
  id: Plan;
  label: string;
  maxSubscriptions: number; // Infinity = illimité
  channels: Channel[]; // canaux de rappel autorisés
  maxMembers: number;
}

export const PLANS: Record<Plan, PlanDef> = {
  free: { id: 'free', label: 'Gratuit', maxSubscriptions: 15, channels: ['email'], maxMembers: 1 },
  pro: {
    id: 'pro',
    label: 'Pro',
    maxSubscriptions: Infinity,
    channels: ['email', 'n8n'],
    maxMembers: 5,
  },
  team: {
    id: 'team',
    label: 'Équipe',
    maxSubscriptions: Infinity,
    channels: ['email', 'n8n'],
    maxMembers: Infinity,
  },
};

export function planOf(plan: string): PlanDef {
  return PLANS[(plan as Plan) in PLANS ? (plan as Plan) : 'free'];
}

/** Bloque la création d'un abonnement au-delà du quota du plan. */
export async function assertWithinQuota(organizationId: string): Promise<void> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  const def = planOf(org?.plan ?? 'free');
  if (def.maxSubscriptions === Infinity) return;
  const count = await prisma.subscription.count({ where: { organizationId } });
  if (count >= def.maxSubscriptions) {
    throw new HttpError(
      402,
      `Limite du plan ${def.label} atteinte (${def.maxSubscriptions} abonnements). Passe au plan Pro pour un nombre illimité.`,
    );
  }
}

/** Filtre les canaux selon le plan (le gating tarifaire). */
export function allowedChannelsForPlan(plan: string, channels: Channel[]): Channel[] {
  const def = planOf(plan);
  return channels.filter((c) => def.channels.includes(c));
}

// ── Stripe (initialisé paresseusement, inerte sans clé) ──────────────
let stripe: Stripe | null = null;
export function getStripe(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  if (!stripe) stripe = new Stripe(env.STRIPE_SECRET_KEY);
  return stripe;
}
export function billingEnabled(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

const PRICE_IDS: Partial<Record<Plan, string>> = {
  pro: env.STRIPE_PRICE_PRO,
  team: env.STRIPE_PRICE_TEAM,
};

/** Crée une session Stripe Checkout pour passer une organisation à un plan payant. */
export async function createCheckoutSession(
  organizationId: string,
  plan: Plan,
): Promise<{ url: string }> {
  const s = getStripe();
  if (!s) throw new HttpError(501, 'Facturation par carte non configurée (STRIPE_SECRET_KEY absent).');
  const price = PRICE_IDS[plan];
  if (!price) throw new HttpError(400, `Aucun tarif Stripe configuré pour le plan ${plan}.`);

  const session = await s.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    success_url: `${env.APP_URL}/?billing=success`,
    cancel_url: `${env.APP_URL}/?billing=cancel`,
    client_reference_id: organizationId,
    metadata: { organizationId, plan },
  });
  if (!session.url) throw new HttpError(502, 'Stripe n’a pas renvoyé d’URL de paiement.');
  return { url: session.url };
}

/** Applique un plan à une organisation (après paiement confirmé). */
export async function setOrganizationPlan(organizationId: string, plan: Plan): Promise<void> {
  await prisma.organization.update({ where: { id: organizationId }, data: { plan } });
}
