import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';

export interface SessionClaims {
  userId: string;
  organizationId: string;
  role: string;
}

const COOKIE_NAME = 'sa_token';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signSession(claims: SessionClaims): string {
  return jwt.sign(claims, env.JWT_SECRET, { expiresIn: '7d' });
}

export function verifySession(token: string): SessionClaims | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as SessionClaims;
  } catch {
    return null;
  }
}

export const cookie = {
  name: COOKIE_NAME,
  options: {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.COOKIE_SECURE,
    maxAge: MAX_AGE_MS,
    path: '/',
  },
};
