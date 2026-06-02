import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db.js';
import { isSuperAdminEmail } from '../routes/auth.js';

/** Exige une session dont l'utilisateur est super-admin (SUPERADMIN_EMAILS). */
export async function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ error: 'Non authentifié.' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
    if (!user || !isSuperAdminEmail(user.email)) {
      res.status(403).json({ error: 'Accès réservé à l’administration de la plateforme.' });
      return;
    }
    next();
  } catch (e) {
    next(e);
  }
}
