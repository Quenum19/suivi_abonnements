import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { prisma } from '../db.js';
import { asyncHandler } from '../lib/http.js';
import { serializeSubscription } from '../lib/serialize.js';
import { computeInsights } from '../services/insights.js';
import { parseRates, formatAmount } from '../lib/currency.js';

export const reportRouter = Router();

// GET /api/report — rapport PDF de l'organisation (synthèse + abonnements).
reportRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const orgId = req.auth!.organizationId;
    const [org, subs] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId } }),
      prisma.subscription.findMany({
        where: { organizationId: orgId },
        orderBy: [{ category: 'asc' }, { expiryDate: 'asc' }],
      }),
    ]);
    const insights = computeInsights(subs, {
      baseCurrency: org?.baseCurrency ?? null,
      rates: parseRates(org?.exchangeRates),
    });
    const now = new Date();
    const brand = org?.brandColor || '#1F4D46';

    const doc = new PDFDocument({ size: 'A4', margin: 44 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="rapport-abonnements.pdf"');
    doc.pipe(res);

    doc.fontSize(22).fillColor(brand).text(org?.name ?? 'Rapport');
    doc.fontSize(11).fillColor('#6E685D').text(`Rapport d'abonnements — ${now.toISOString().slice(0, 10)}`);
    doc.moveDown();

    doc.fontSize(14).fillColor('#1B1A17').text('Synthèse');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#333333');
    doc.text(
      `Abonnements suivis : ${insights.counts.total}  (actifs ${insights.counts.active}, inutilisés ${insights.counts.unused}, annulés ${insights.counts.cancelled})`,
    );
    if (insights.baseCurrency && insights.consolidated) {
      doc.text(
        `Coût total consolidé : ${formatAmount(insights.consolidated.yearly, insights.baseCurrency)}/an  ·  ${formatAmount(insights.consolidated.monthly, insights.baseCurrency)}/mois`,
      );
      doc.text(
        `Économies potentielles : ${formatAmount(insights.consolidated.savings, insights.baseCurrency)}/an`,
      );
    } else {
      for (const [cur, t] of Object.entries(insights.totalsByCurrency)) {
        doc.text(`Total ${cur} : ${formatAmount(t.yearly, cur)}/an`);
      }
    }
    doc.moveDown();

    doc.fontSize(14).fillColor('#1B1A17').text('Abonnements');
    doc.moveDown(0.4);
    const rows = subs.map((s) => serializeSubscription(s, now));
    for (const s of rows) {
      const amount = s.amount != null ? formatAmount(s.amount, s.currency || 'EUR') : '—';
      doc
        .fontSize(10)
        .fillColor('#1B1A17')
        .text(`${s.name}`, { continued: true })
        .fillColor('#6E685D')
        .text(`  [${s.category}]`);
      doc
        .fontSize(9)
        .fillColor('#444444')
        .text(
          `  Échéance ${s.expiryDate} (${s.daysLeft} j) · ${amount} · ${s.frequency}${s.autoRenew ? ' · renouvellement auto' : ''}`,
        );
      doc.moveDown(0.3);
    }

    doc.end();
  }),
);
