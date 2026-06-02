import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { asyncHandler, HttpError } from '../lib/http.js';

export const organizationRouter = Router();

// Couleur hex (#RGB ou #RRGGBB).
const hexColor = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Couleur hexadécimale invalide')
  .nullable();

// Logo : URL http(s) ou data URL image, taille raisonnable (~700 Ko en base64).
const logo = z
  .string()
  .trim()
  .max(1_000_000)
  .refine((s) => s === '' || /^(https?:\/\/|data:image\/)/.test(s), 'Logo : URL ou image attendue')
  .nullable();

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  brandColor: hexColor.optional(),
  logoUrl: logo.optional(),
  baseCurrency: z.string().trim().max(8).nullable().optional(),
  // { "EUR": 655.96, "USD": 600 } : valeur de 1 unité en devise de référence.
  exchangeRates: z.record(z.number().positive()).nullable().optional(),
});

// PUT /api/organization — paramètres + personnalisation (owner/admin).
organizationRouter.put(
  '/',
  asyncHandler(async (req, res) => {
    if (!['owner', 'admin'].includes(req.auth!.role)) {
      throw new HttpError(403, 'Réservé au propriétaire ou à un administrateur.');
    }
    const input = updateSchema.parse(req.body);
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.brandColor !== undefined) data.brandColor = input.brandColor || null;
    if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl || null;
    if (input.baseCurrency !== undefined) data.baseCurrency = input.baseCurrency || null;
    if (input.exchangeRates !== undefined) {
      data.exchangeRates = input.exchangeRates ? JSON.stringify(input.exchangeRates) : null;
    }

    const org = await prisma.organization.update({
      where: { id: req.auth!.organizationId },
      data,
    });
    res.json({
      data: {
        id: org.id,
        name: org.name,
        plan: org.plan,
        brandColor: org.brandColor,
        logoUrl: org.logoUrl,
        baseCurrency: org.baseCurrency,
        exchangeRates: org.exchangeRates,
      },
    });
  }),
);
