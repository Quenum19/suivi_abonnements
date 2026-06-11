import { Router } from 'express';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { prisma } from '../db.js';
import { asyncHandler, HttpError } from '../lib/http.js';
import { PLANS, planOf, type Plan } from '../services/billing.js';
import { toCsv } from '../lib/csv.js';
import { footers, header, statCards, table } from '../lib/pdf.js';

export const adminRouter = Router();

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

// Estimation MRR : prix mensuels indicatifs par plan (en EUR), paramétrables.
const PLAN_PRICE_EUR: Record<Plan, number> = { free: 0, pro: 12, team: 39 };

// GET /api/admin/overview — vue d'ensemble plateforme.
adminRouter.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const [orgs, users, subs, reminders, plansGroup, activeUsers7, activeUsers30, newOrgs30] =
      await Promise.all([
        prisma.organization.count(),
        prisma.user.count(),
        prisma.subscription.count(),
        prisma.reminderSent.count(),
        prisma.organization.groupBy({ by: ['plan'], _count: { _all: true } }),
        prisma.user.count({ where: { lastLoginAt: { gte: daysAgo(7) } } }),
        prisma.user.count({ where: { lastLoginAt: { gte: daysAgo(30) } } }),
        prisma.organization.count({ where: { createdAt: { gte: daysAgo(30) } } }),
      ]);

    const byPlan: Record<string, number> = { free: 0, pro: 0, team: 0 };
    let mrr = 0;
    for (const g of plansGroup) {
      byPlan[g.plan] = g._count._all;
      mrr += (PLAN_PRICE_EUR[(g.plan as Plan) in PLANS ? (g.plan as Plan) : 'free'] ?? 0) * g._count._all;
    }
    const suspended = await prisma.organization.count({ where: { status: 'suspended' } });
    const revenueByPlan = {
      pro: (byPlan.pro || 0) * PLAN_PRICE_EUR.pro,
      team: (byPlan.team || 0) * PLAN_PRICE_EUR.team,
    };

    res.json({
      data: {
        totals: { organizations: orgs, users, subscriptions: subs, remindersSent: reminders },
        byPlan,
        revenueByPlan,
        suspended,
        mrrEur: mrr,
        activity: { activeUsers7d: activeUsers7, activeUsers30d: activeUsers30, newOrgs30d: newOrgs30 },
      },
    });
  }),
);

// GET /api/admin/growth — inscriptions des 6 derniers mois (séries temporelles).
adminRouter.get(
  '/growth',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const months: { month: string; orgs: number; users: number }[] = [];
    const orgsAll = await prisma.organization.findMany({ select: { createdAt: true } });
    const usersAll = await prisma.user.findMany({ select: { createdAt: true } });
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const inMonth = (dt: Date) =>
        dt.getFullYear() === d.getFullYear() && dt.getMonth() === d.getMonth();
      months.push({
        month: key,
        orgs: orgsAll.filter((o) => inMonth(o.createdAt)).length,
        users: usersAll.filter((u) => inMonth(u.createdAt)).length,
      });
    }
    res.json({ data: months });
  }),
);

// GET /api/admin/organizations?sort=subs|reminders|recent — clients (entreprises).
adminRouter.get(
  '/organizations',
  asyncHandler(async (req, res) => {
    const orgs = await prisma.organization.findMany({
      include: {
        _count: { select: { subscriptions: true, reminders: true, memberships: true } },
        memberships: {
          include: { user: { select: { email: true, lastLoginAt: true, loginCount: true } } },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    let rows = orgs.map((o) => {
      const owner = o.memberships[0]?.user;
      return {
        id: o.id,
        name: o.name,
        plan: o.plan,
        status: o.status,
        ownerEmail: owner?.email ?? null,
        subscriptions: o._count.subscriptions,
        reminders: o._count.reminders,
        members: o._count.memberships,
        lastLoginAt: owner?.lastLoginAt ? owner.lastLoginAt.toISOString() : null,
        loginCount: owner?.loginCount ?? 0,
        createdAt: o.createdAt.toISOString(),
      };
    });

    const sort = String(req.query.sort ?? 'subs');
    rows = rows.sort((a, b) => {
      if (sort === 'reminders') return b.reminders - a.reminders;
      if (sort === 'recent') return (b.lastLoginAt ?? '').localeCompare(a.lastLoginAt ?? '');
      if (sort === 'logins') return b.loginCount - a.loginCount;
      return b.subscriptions - a.subscriptions; // défaut : « qui a le plus de tâches »
    });

    res.json({ data: rows });
  }),
);

// GET /api/admin/organizations.csv — export du rapport clients.
adminRouter.get(
  '/organizations.csv',
  asyncHandler(async (_req, res) => {
    const orgs = await prisma.organization.findMany({
      include: {
        _count: { select: { subscriptions: true, reminders: true, memberships: true } },
        memberships: { include: { user: true }, orderBy: { createdAt: 'asc' }, take: 1 },
      },
    });
    const rows = orgs.map((o) => ({
      name: o.name,
      ownerEmail: o.memberships[0]?.user.email ?? '',
      plan: o.plan,
      status: o.status,
      subscriptions: o._count.subscriptions,
      reminders: o._count.reminders,
      members: o._count.memberships,
      createdAt: o.createdAt.toISOString().slice(0, 10),
    }));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="clients.csv"');
    res.send(
      '﻿' +
        toCsv(rows, ['name', 'ownerEmail', 'plan', 'status', 'subscriptions', 'reminders', 'members', 'createdAt']),
    );
  }),
);

// GET /api/admin/organizations.pdf — rapport clients en PDF professionnel.
adminRouter.get(
  '/organizations.pdf',
  asyncHandler(async (_req, res) => {
    const [orgs, totalUsers] = await Promise.all([
      prisma.organization.findMany({
        include: { _count: { select: { subscriptions: true, memberships: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.user.count(),
    ]);
    let mrr = 0;
    for (const o of orgs) mrr += PLAN_PRICE_EUR[(o.plan as Plan) in PLANS ? (o.plan as Plan) : 'free'];

    const doc = new PDFDocument({ size: 'A4', margin: 44, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="rapport-clients.pdf"');
    doc.pipe(res);

    const brand = '#1F4D46';
    const today = new Date().toISOString().slice(0, 10).split('-').reverse().join('/');
    header(doc, { brand, title: 'Rapport plateforme', subtitle: `Clients & activité — ${today}`, logo: null });

    statCards(
      doc,
      [
        { label: 'Entreprises', value: `${orgs.length}` },
        { label: 'Utilisateurs', value: `${totalUsers}` },
        { label: 'MRR estimé', value: `${mrr} €` },
      ],
      brand,
    );

    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1B1A17').text('Clients');
    doc.moveDown(0.5);

    const rows = orgs.map((o) => [
      o.name,
      o.plan,
      o.status === 'suspended' ? 'Suspendu' : 'Actif',
      `${o._count.subscriptions}`,
      `${o._count.memberships}`,
      o.createdAt.toISOString().slice(0, 10).split('-').reverse().join('/'),
    ]);

    table(
      doc,
      [
        { label: 'Entreprise', width: 2.6 },
        { label: 'Plan', width: 1 },
        { label: 'Statut', width: 1.2 },
        { label: 'Abos', width: 0.8, align: 'right' },
        { label: 'Membres', width: 1, align: 'right' },
        { label: 'Créé le', width: 1.3 },
      ],
      rows,
      brand,
    );

    footers(doc, 'Suivi des abonnements · Administration');
    doc.end();
  }),
);

// GET /api/admin/users?sort=logins|recent — utilisateurs.
adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      include: { memberships: { include: { organization: { select: { name: true } } }, take: 1 } },
    });
    let rows = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      organization: u.memberships[0]?.organization.name ?? null,
      loginCount: u.loginCount,
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
    }));
    const sort = String(req.query.sort ?? 'logins');
    rows = rows.sort((a, b) =>
      sort === 'recent'
        ? (b.lastLoginAt ?? '').localeCompare(a.lastLoginAt ?? '')
        : b.loginCount - a.loginCount,
    );
    res.json({ data: rows });
  }),
);

// PATCH /api/admin/organizations/:id — change le plan ou suspend/réactive.
const patchSchema = z.object({
  plan: z.enum(['free', 'pro', 'team']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
});
adminRouter.patch(
  '/organizations/:id',
  asyncHandler(async (req, res) => {
    const input = patchSchema.parse(req.body);
    if (input.plan === undefined && input.status === undefined) {
      throw new HttpError(400, 'Rien à modifier (plan ou status requis).');
    }
    const existing = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, 'Organisation introuvable.');
    const org = await prisma.organization.update({
      where: { id: req.params.id },
      data: { ...(input.plan ? { plan: input.plan } : {}), ...(input.status ? { status: input.status } : {}) },
    });
    res.json({ data: { id: org.id, plan: org.plan, status: org.status, planLabel: planOf(org.plan).label } });
  }),
);
