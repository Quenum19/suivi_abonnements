import { z } from 'zod';

/** Accepte 'AAAA-MM-JJ' ou une date ISO complète, renvoie un Date. */
const dateInput = z
  .string()
  .min(1)
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Date invalide' })
  .transform((s) => new Date(s.length === 10 ? `${s}T00:00:00.000Z` : s));

const optionalDate = dateInput.nullable().optional();

export const createSubscriptionSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis').max(200),
  category: z.string().trim().min(1).max(120).default('Autres'),
  startDate: optionalDate,
  expiryDate: dateInput,
  amount: z.number().finite().nonnegative().nullable().optional(),
  currency: z.string().trim().min(1).max(8).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  frequency: z
    .enum(['weekly', 'monthly', 'quarterly', 'yearly', 'one_time'])
    .default('yearly'),
  status: z.enum(['active', 'unused', 'cancelled']).default('active'),
  responsible: z.string().trim().max(200).nullable().optional(),
  autoRenew: z.boolean().optional().default(false),
});

// Tous les champs deviennent optionnels pour PATCH/PUT.
export const updateSubscriptionSchema = createSubscriptionSchema.partial();

export const runRemindersSchema = z.object({
  // Permet de forcer une "date du jour" en test (ex. webhook.site).
  asOf: dateInput.optional(),
  dryRun: z.boolean().optional().default(false),
});

export const importSchema = z.object({
  items: z.array(createSubscriptionSchema).min(1),
  replace: z.boolean().optional().default(false),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
