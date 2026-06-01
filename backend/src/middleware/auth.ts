import type { NextFunction, Request, Response } from 'express';
import { cookie, verifySession, type SessionClaims } from '../lib/auth.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: SessionClaims;
    }
  }
}

/** Lit le JWT (cookie httpOnly ou en-tête Bearer) et renseigne req.auth. */
function readClaims(req: Request): SessionClaims | null {
  const fromCookie = req.cookies?.[cookie.name];
  const header = req.header('authorization');
  const fromHeader = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const token = fromCookie || fromHeader;
  return token ? verifySession(token) : null;
}

/** Exige une session valide ; sinon 401. Scope multi-tenant via req.auth.organizationId. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const claims = readClaims(req);
  if (!claims) {
    res.status(401).json({ error: 'Non authentifié.' });
    return;
  }
  req.auth = claims;
  next();
}
