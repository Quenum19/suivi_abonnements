import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { asyncHandler, HttpError } from '../lib/http.js';
import { cookie, hashPassword, signSession, verifyPassword } from '../lib/auth.js';
import { requireAuth } from '../middleware/auth.js';

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
  const token = signSession({
    userId,
    organizationId: membership.organizationId,
    role: membership.role,
  });
  return {
    token,
    body: {
      user: { id: membership.user.id, email: membership.user.email, name: membership.user.name },
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        plan: membership.organization.plan,
        calendarToken: membership.organization.calendarToken,
        inboundToken: membership.organization.inboundToken,
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
