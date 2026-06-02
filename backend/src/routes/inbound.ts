import { Router } from 'express';
import { prisma } from '../db.js';
import { parseInvoice } from '../lib/invoiceParser.js';
import { asyncHandler, HttpError } from '../lib/http.js';
import { assertWithinQuota } from '../services/billing.js';

export const inboundRouter = Router();

/**
 * ÉTAPE 4 — Import de facture par email/webhook entrant.
 * POST /api/inbound/:token
 *   body JSON ou form-urlencoded : { subject, text|body, from }
 *
 * Brancher un fournisseur d'email entrant (SendGrid Inbound Parse, Mailgun
 * Routes) OU un nœud n8n « Email Trigger » qui POSTe le mail ici. Le :token
 * (inboundToken de l'organisation) identifie l'espace cible. Le parser
 * heuristique crée l'abonnement ; il reste modifiable ensuite dans l'UI.
 */
inboundRouter.post(
  '/:token',
  asyncHandler(async (req, res) => {
    const org = await prisma.organization.findUnique({ where: { inboundToken: req.params.token } });
    if (!org) throw new HttpError(404, 'Jeton entrant inconnu.');

    const { subject, text, body, from } = req.body ?? {};
    const draft = parseInvoice({ subject, body: body ?? text, text });

    if (!draft.expiryDate) {
      throw new HttpError(422, 'Aucune date d’échéance détectée dans le message.');
    }
    await assertWithinQuota(org.id);

    const sub = await prisma.subscription.create({
      data: {
        organizationId: org.id,
        name: draft.name || 'Abonnement importé',
        category: 'Importé',
        expiryDate: new Date(`${draft.expiryDate}T00:00:00.000Z`),
        amount: draft.amount,
        currency: draft.currency,
        frequency: draft.frequency ?? 'yearly',
        notes: from ? `Importé depuis l'e-mail de ${from}.` : 'Importé par e-mail.',
      },
    });

    res.status(201).json({ data: { id: sub.id, name: sub.name, parsed: draft } });
  }),
);
