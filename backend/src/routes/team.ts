import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { asyncHandler, HttpError } from '../lib/http.js';
import { hashPassword } from '../lib/auth.js';
import { assertWithinMemberQuota } from '../services/billing.js';

export const teamRouter = Router();

function requireManager(role: string) {
  if (!['owner', 'admin'].includes(role)) {
    throw new HttpError(403, 'Réservé au propriétaire ou à un administrateur.');
  }
}

/** Mot de passe temporaire lisible (l'invité le changera). */
function tempPassword(): string {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

// GET /api/team — membres de l'organisation courante.
teamRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const members = await prisma.membership.findMany({
      where: { organizationId: req.auth!.organizationId },
      include: { user: { select: { id: true, email: true, name: true, lastLoginAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({
      data: members.map((m) => ({
        userId: m.user.id,
        email: m.user.email,
        name: m.user.name,
        role: m.role,
        lastLoginAt: m.user.lastLoginAt ? m.user.lastLoginAt.toISOString() : null,
        isSelf: m.user.id === req.auth!.userId,
      })),
    });
  }),
);

const inviteSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  role: z.enum(['admin', 'member']).default('member'),
});

// POST /api/team/invite — ajoute un membre (owner/admin), quota selon le plan.
teamRouter.post(
  '/invite',
  asyncHandler(async (req, res) => {
    requireManager(req.auth!.role);
    const { email, role } = inviteSchema.parse(req.body);
    const orgId = req.auth!.organizationId;

    await assertWithinMemberQuota(orgId);

    // L'utilisateur existe déjà ? (compte global) — sinon on le crée.
    let user = await prisma.user.findUnique({ where: { email } });
    let generated: string | null = null;
    if (!user) {
      generated = tempPassword();
      user = await prisma.user.create({
        data: { email, passwordHash: await hashPassword(generated) },
      });
    }

    const already = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
    });
    if (already) throw new HttpError(409, 'Cette personne fait déjà partie de l’équipe.');

    await prisma.membership.create({ data: { userId: user.id, organizationId: orgId, role } });

    res.status(201).json({
      data: {
        email,
        role,
        // Mot de passe temporaire à transmettre (uniquement si compte créé).
        temporaryPassword: generated,
        existingAccount: generated === null,
      },
    });
  }),
);

const roleSchema = z.object({ role: z.enum(['admin', 'member']) });

// PATCH /api/team/:userId — change le rôle d'un membre (pas le owner, pas soi-même).
teamRouter.patch(
  '/:userId',
  asyncHandler(async (req, res) => {
    requireManager(req.auth!.role);
    const { role } = roleSchema.parse(req.body);
    const orgId = req.auth!.organizationId;
    const m = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: req.params.userId, organizationId: orgId } },
    });
    if (!m) throw new HttpError(404, 'Membre introuvable.');
    if (m.role === 'owner') throw new HttpError(400, 'Le rôle du propriétaire ne peut pas changer.');
    await prisma.membership.update({
      where: { userId_organizationId: { userId: req.params.userId, organizationId: orgId } },
      data: { role },
    });
    res.json({ data: { userId: req.params.userId, role } });
  }),
);

// DELETE /api/team/:userId — retire un membre (pas le owner, pas soi-même).
teamRouter.delete(
  '/:userId',
  asyncHandler(async (req, res) => {
    requireManager(req.auth!.role);
    const orgId = req.auth!.organizationId;
    if (req.params.userId === req.auth!.userId) {
      throw new HttpError(400, 'Vous ne pouvez pas vous retirer vous-même.');
    }
    const m = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: req.params.userId, organizationId: orgId } },
    });
    if (!m) throw new HttpError(404, 'Membre introuvable.');
    if (m.role === 'owner') throw new HttpError(400, 'Le propriétaire ne peut pas être retiré.');
    await prisma.membership.delete({
      where: { userId_organizationId: { userId: req.params.userId, organizationId: orgId } },
    });
    res.status(204).end();
  }),
);
