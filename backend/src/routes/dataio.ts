import { Router } from 'express';
import { prisma } from '../db.js';
import { CSV_COLUMNS, parseCsv, toCsv } from '../lib/csv.js';
import { createSubscriptionSchema, importSchema } from '../schemas.js';
import { asyncHandler, HttpError } from '../lib/http.js';
import { parseInvoice } from '../lib/invoiceParser.js';
import { serializeSubscription } from '../lib/serialize.js';

export const dataioRouter = Router();

// Colonnes d'export enrichies (computées incluses).
const EXPORT_COLUMNS = [
  'name', 'category', 'startDate', 'expiryDate', 'frequency', 'amount', 'currency',
  'autoRenew', 'status', 'daysLeft', 'monthlyCost', 'annualCost', 'notes',
] as const;

// GET /api/export?format=json|csv
dataioRouter.get(
  '/export',
  asyncHandler(async (req, res) => {
    const orgId = req.auth!.organizationId;
    const format = (req.query.format as string) === 'csv' ? 'csv' : 'json';
    const [org, subs] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId } }),
      prisma.subscription.findMany({ where: { organizationId: orgId }, orderBy: [{ category: 'asc' }, { expiryDate: 'asc' }] }),
    ]);
    const now = new Date();
    const items = subs.map((s) => {
      const v = serializeSubscription(s, now);
      return {
        name: v.name,
        category: v.category,
        startDate: v.startDate ?? '',
        expiryDate: v.expiryDate ?? '',
        frequency: v.frequency,
        amount: v.amount ?? '',
        currency: v.currency ?? '',
        autoRenew: v.autoRenew,
        status: v.lifecycle,
        daysLeft: v.daysLeft,
        monthlyCost: v.monthlyCost ?? '',
        annualCost: v.annualCost ?? '',
        notes: v.notes ?? '',
      };
    });
    const stamp = now.toISOString().slice(0, 10);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="abonnements-${stamp}.csv"`);
      // BOM UTF-8 pour un affichage correct des accents dans Excel.
      res.send('﻿' + toCsv(items, EXPORT_COLUMNS));
    } else {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="abonnements-${stamp}.json"`);
      res.send(
        JSON.stringify(
          {
            generatedAt: now.toISOString(),
            organization: org?.name ?? null,
            baseCurrency: org?.baseCurrency ?? null,
            count: items.length,
            items,
          },
          null,
          2,
        ),
      );
    }
  }),
);

// POST /api/import  body: { items: [...], replace?: bool }   (JSON)
dataioRouter.post(
  '/import',
  asyncHandler(async (req, res) => {
    const { items, replace } = importSchema.parse(req.body);
    const count = await importItems(req.auth!.organizationId, items, replace);
    res.json({ data: { imported: count, replaced: replace } });
  }),
);

// POST /api/import/csv  body: { csv: string, replace?: bool }  OU  text/csv brut
dataioRouter.post(
  '/import/csv',
  asyncHandler(async (req, res) => {
    const raw =
      typeof req.body === 'string'
        ? req.body
        : typeof req.body?.csv === 'string'
          ? req.body.csv
          : null;
    if (!raw) throw new HttpError(400, 'CSV manquant (envoyer text/csv ou { csv }).');
    const replace = req.body?.replace === true;

    const parsed = parseCsv(raw);
    const items = parsed.map((r, i) => {
      try {
        const truthy = (v: string | undefined) => ['1', 'true', 'oui', 'yes'].includes((v || '').toLowerCase());
        return createSubscriptionSchema.parse({
          name: r.name,
          category: r.category || 'Autres',
          startDate: r.startDate || null,
          expiryDate: r.expiryDate,
          amount: r.amount ? Number(String(r.amount).replace(',', '.')) : null,
          currency: r.currency || null,
          notes: r.notes || null,
          ...(r.frequency ? { frequency: r.frequency } : {}),
          ...(r.status ? { status: r.status } : {}),
          ...(r.autoRenew !== undefined ? { autoRenew: truthy(r.autoRenew) } : {}),
        });
      } catch {
        throw new HttpError(400, `Ligne CSV ${i + 2} invalide (colonnes: ${CSV_COLUMNS.join(', ')}).`);
      }
    });
    const count = await importItems(req.auth!.organizationId, items, replace);
    res.json({ data: { imported: count, replaced: replace } });
  }),
);

// POST /api/import/parse — analyse un texte de facture (sans enregistrer).
dataioRouter.post(
  '/import/parse',
  asyncHandler(async (req, res) => {
    const { subject, body, text } = req.body ?? {};
    const draft = parseInvoice({ subject, body, text });
    res.json({ data: draft });
  }),
);

async function importItems(
  organizationId: string,
  items: { expiryDate: Date; [k: string]: unknown }[],
  replace: boolean,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    if (replace) await tx.subscription.deleteMany({ where: { organizationId } });
    let n = 0;
    for (const it of items) {
      await tx.subscription.create({ data: { ...it, organizationId } as never });
      n++;
    }
    return n;
  });
}
