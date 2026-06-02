import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../lib/http.js';
import { daysLeft, statusOf } from '../lib/dates.js';
import { planOf } from '../services/billing.js';

export const notificationsRouter = Router();

type Severity = 'urgent' | 'soon' | 'info';
interface Notif {
  id: string;
  type: 'expiry' | 'unused' | 'quota';
  severity: Severity;
  title: string;
  subtitle: string;
}

// GET /api/notifications — éléments à traiter (cloche in-app).
notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const orgId = req.auth!.organizationId;
    const [subs, org] = await Promise.all([
      prisma.subscription.findMany({ where: { organizationId: orgId } }),
      prisma.organization.findUnique({ where: { id: orgId } }),
    ]);
    const now = new Date();
    const items: Notif[] = [];

    for (const s of subs) {
      if (s.status === 'cancelled') continue;
      const dl = daysLeft(s.expiryDate, now);
      if (dl >= 0 && dl <= 60) {
        items.push({
          id: `exp-${s.id}`,
          type: 'expiry',
          severity: statusOf(dl) === 'urgent' ? 'urgent' : 'soon', // ≤30 | ≤60
          title: s.name,
          subtitle: dl === 0 ? "Échéance aujourd'hui" : `Échéance dans ${dl} j`,
        });
      } else if (dl < 0) {
        items.push({
          id: `exp-${s.id}`,
          type: 'expiry',
          severity: 'urgent',
          title: s.name,
          subtitle: `Expiré depuis ${Math.abs(dl)} j`,
        });
      }
      if (s.status === 'unused') {
        items.push({
          id: `unused-${s.id}`,
          type: 'unused',
          severity: 'info',
          title: s.name,
          subtitle: 'Marqué inutilisé — pensez à résilier',
        });
      }
    }

    // Quota du plan atteint.
    const def = planOf(org?.plan ?? 'free');
    if (def.maxSubscriptions !== Infinity && subs.length >= def.maxSubscriptions) {
      items.push({
        id: 'quota',
        type: 'quota',
        severity: 'info',
        title: `Limite du plan ${def.label} atteinte`,
        subtitle: `${subs.length}/${def.maxSubscriptions} abonnements — passez à un plan supérieur`,
      });
    }

    // Tri : urgent → soon → info.
    const rank: Record<Severity, number> = { urgent: 0, soon: 1, info: 2 };
    items.sort((a, b) => rank[a.severity] - rank[b.severity]);

    res.json({ data: { count: items.length, items } });
  }),
);
