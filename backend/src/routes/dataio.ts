import { Router } from 'express';
import { prisma } from '../db.js';
import { CSV_COLUMNS, parseCsv, toCsv } from '../lib/csv.js';
import { createSubscriptionSchema, importSchema } from '../schemas.js';
import { asyncHandler, HttpError } from '../lib/http.js';

export const dataioRouter = Router();

const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

// GET /api/export?format=json|csv
dataioRouter.get(
  '/export',
  asyncHandler(async (req, res) => {
    const format = (req.query.format as string) === 'csv' ? 'csv' : 'json';
    const subs = await prisma.subscription.findMany({ orderBy: { category: 'asc' } });
    const rows = subs.map((s) => ({
      name: s.name,
      category: s.category,
      startDate: isoDay(s.startDate),
      expiryDate: isoDay(s.expiryDate),
      amount: s.amount ?? '',
      currency: s.currency ?? '',
      notes: s.notes ?? '',
    }));

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="abonnements.csv"');
      res.send(toCsv(rows));
    } else {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="abonnements.json"');
      res.send(JSON.stringify(rows, null, 2));
    }
  }),
);

// POST /api/import  body: { items: [...], replace?: bool }   (JSON)
dataioRouter.post(
  '/import',
  asyncHandler(async (req, res) => {
    const { items, replace } = importSchema.parse(req.body);
    const count = await importItems(items, replace);
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
        return createSubscriptionSchema.parse({
          name: r.name,
          category: r.category || 'Autres',
          startDate: r.startDate || null,
          expiryDate: r.expiryDate,
          amount: r.amount ? Number(String(r.amount).replace(',', '.')) : null,
          currency: r.currency || null,
          notes: r.notes || null,
        });
      } catch {
        throw new HttpError(400, `Ligne CSV ${i + 2} invalide (colonnes: ${CSV_COLUMNS.join(', ')}).`);
      }
    });
    const count = await importItems(items, replace);
    res.json({ data: { imported: count, replaced: replace } });
  }),
);

async function importItems(
  items: { expiryDate: Date; [k: string]: unknown }[],
  replace: boolean,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    if (replace) await tx.subscription.deleteMany({});
    let n = 0;
    for (const it of items) {
      await tx.subscription.create({ data: it as never });
      n++;
    }
    return n;
  });
}
