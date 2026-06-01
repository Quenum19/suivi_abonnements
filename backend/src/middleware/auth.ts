import type { NextFunction, Request, Response } from 'express';
import { env } from '../env.js';

/**
 * Auth MVP mono-utilisateur : si APP_PASSWORD est défini, chaque requête /api
 * doit présenter l'en-tête `x-app-password`. Vide = auth désactivée (dev).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!env.APP_PASSWORD) return next();
  const provided = req.header('x-app-password');
  if (provided && provided === env.APP_PASSWORD) return next();
  res.status(401).json({ error: 'Non autorisé : mot de passe applicatif manquant ou invalide.' });
}
