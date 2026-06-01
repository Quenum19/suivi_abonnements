import { prisma } from '../db.js';
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
