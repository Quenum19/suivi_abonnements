import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { asyncHandler, HttpError } from '../lib/http.js';
import { cookie, hashPassword, signSession, verifyPassword } from '../lib/auth.js';
import { requireAuth } from '../middleware/auth.js';

export function isSuperAdminEmail(email: string): boolean {
  return env.SUPERADMIN_EMAILS.includes(email.toLowerCase());
}

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8, 'Mot de passe : 8 caractères minimum'),
  name: z.string().trim().max(120).optional(),
  organizationName: z.string().trim().min(1).max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1),
});

async function sessionResponse(userId: string) {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    include: { organization: true, user: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!membership) throw new HttpError(500, 'Aucune organisation associée.');
  const superAdmin = isSuperAdminEmail(membership.user.email);
  if (membership.organization.status === 'suspended' && !superAdmin) {
    throw new HttpError(403, 'Compte suspendu. Contactez le support.');
  }
  const token = signSession({
    userId,
    organizationId: membership.organizationId,
    role: membership.role,
  });
  return {
    token,
    body: {
      user: {
        id: membership.user.id,
        email: membership.user.email,
        name: membership.user.name,
        isSuperAdmin: superAdmin,
      },
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        plan: membership.organization.plan,
        calendarToken: membership.organization.calendarToken,
        inboundToken: membership.organization.inboundToken,
        logoUrl: membership.organization.logoUrl,
        brandColor: membership.organization.brandColor,
        status: membership.organization.status,
      },
      role: membership.role,
    },
  };
}

// POST /api/auth/register — crée l'utilisateur + son organisation + l'adhésion.
authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw new HttpError(409, 'Un compte existe déjà avec cet e-mail.');

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash: await hashPassword(input.password),
        name: input.name ?? null,
        memberships: {
          create: {
            role: 'owner',
            organization: {
              create: { name: input.organizationName || `Espace de ${input.email}` },
            },
          },
        },
      },
    });

    const { token, body } = await sessionResponse(user.id);
    res.cookie(cookie.name, token, cookie.options);
    res.status(201).json({ data: body });
  }),
);

// POST /api/auth/login
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new HttpError(401, 'E-mail ou mot de passe incorrect.');
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    });
    const { token, body } = await sessionResponse(user.id);
    res.cookie(cookie.name, token, cookie.options);
    res.json({ data: body });
  }),
);

// POST /api/auth/logout
authRouter.post('/logout', (_req, res) => {
  res.clearCookie(cookie.name, { ...cookie.options, maxAge: undefined });
  res.json({ data: { ok: true } });
});

// GET /api/auth/me — session courante.
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { body } = await sessionResponse(req.auth!.userId);
    res.json({ data: body });
  }),
);

// POST /api/auth/password — changement de mot de passe (session courante).
const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Nouveau mot de passe : 8 caractères minimum'),
});
authRouter.post(
  '/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = passwordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new HttpError(401, 'Mot de passe actuel incorrect.');
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    res.json({ data: { ok: true } });
  }),
);
