import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { prisma } from '../db.js';
import { asyncHandler } from '../lib/http.js';
import { serializeSubscription } from '../lib/serialize.js';
import { computeInsights } from '../services/insights.js';
import { parseRates, formatAmount } from '../lib/currency.js';
import { FREQUENCY_LABELS, type Frequency } from '../lib/cost.js';
import { footers, getLogoBuffer, header, safeBrand, statCards, table } from '../lib/pdf.js';

export const reportRouter = Router();

const frLabel = (f: string) => FREQUENCY_LABELS[f as Frequency] ?? f;
const frDate = (iso: string | null) => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

// GET /api/report — rapport PDF professionnel de l'organisation.
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
    const brand = safeBrand(org?.brandColor);
    const logo = await getLogoBuffer(org?.logoUrl);

    const doc = new PDFDocument({ size: 'A4', margin: 44, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="rapport-abonnements.pdf"');
    doc.pipe(res);

    header(doc, {
      brand,
      title: org?.name ?? 'Rapport',
      subtitle: `Rapport d'abonnements — ${frDate(now.toISOString())}`,
      logo,
    });

    // Cartes de synthèse.
    const cards: { label: string; value: string }[] = [
      { label: 'Abonnements suivis', value: `${insights.counts.total}` },
    ];
    if (insights.baseCurrency && insights.consolidated) {
      cards.push({
        label: `Coût annuel (${insights.baseCurrency})`,
        value: formatAmount(insights.consolidated.yearly, insights.baseCurrency),
      });
      cards.push({
        label: `Économies / an`,
        value: formatAmount(insights.consolidated.savings, insights.baseCurrency),
      });
    } else {
      const first = Object.entries(insights.totalsByCurrency)[0];
      if (first) cards.push({ label: `Coût annuel (${first[0]})`, value: formatAmount(first[1].yearly, first[0]) });
      cards.push({ label: 'Actifs / inutilisés', value: `${insights.counts.active} / ${insights.counts.unused}` });
    }
    statCards(doc, cards, brand);

    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1B1A17').text('Détail des abonnements');
    doc.moveDown(0.5);

    const rows = subs.map((s) => {
      const v = serializeSubscription(s, now);
      const amount = v.amount != null ? formatAmount(v.amount, v.currency || 'EUR') : '—';
      const days = v.daysLeft < 0 ? `+${Math.abs(v.daysLeft)} j retard` : `${v.daysLeft} j`;
      const freq = frLabel(v.frequency) + (v.autoRenew ? ' · auto' : '');
      const status = v.lifecycle === 'unused' ? '· inutilisé' : v.lifecycle === 'cancelled' ? '· annulé' : '';
      return [v.name + (status ? ` ${status}` : ''), v.category, frDate(v.expiryDate), days, amount, freq];
    });

    table(
      doc,
      [
        { label: 'Abonnement', width: 2.4 },
        { label: 'Catégorie', width: 2 },
        { label: 'Échéance', width: 1.3, align: 'left' },
        { label: 'Reste', width: 1, align: 'right' },
        { label: 'Montant', width: 1.3, align: 'right' },
        { label: 'Périodicité', width: 1.6 },
      ],
      rows,
      brand,
    );

    footers(doc, `${org?.name ?? ''} · Suivi des abonnements`);
    doc.end();
  }),
);
