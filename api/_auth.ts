/**
 * Kora - Autenticación de usuarios (server-side only)
 *
 * Emite y valida los tokens de sesión (JWT) que identifican a cada usuario
 * registrado, y hashea/verifica contraseñas. Nada de esto llega al browser
 * salvo el propio token firmado, que el cliente reenvía en cada request como
 * `Authorization: Bearer <token>`.
 *
 * Variable de entorno requerida:
 *   KORA_JWT_SECRET - cadena aleatoria larga usada para firmar los tokens.
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const TOKEN_TTL = '30d';
const BCRYPT_ROUNDS = 10;

export interface SessionPayload {
  sub: string; // userId
}

function getJwtSecret(): string {
  const secret = process.env.KORA_JWT_SECRET;
  if (!secret || secret.trim().length < 16) throw new Error('MISSING_JWT_SECRET');
  return secret;
}

export function signSessionToken(userId: string): string {
  return jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: TOKEN_TTL });
}

/** Throws 'UNAUTHORIZED' if the header is missing, malformed or the token is invalid/expired. */
export function getUserIdFromAuthHeader(headerValue: string | null | undefined): string {
  if (!headerValue || !headerValue.startsWith('Bearer ')) throw new Error('UNAUTHORIZED');
  const token = headerValue.slice('Bearer '.length).trim();
  if (!token) throw new Error('UNAUTHORIZED');

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as SessionPayload;
    if (!decoded || typeof decoded.sub !== 'string' || !decoded.sub) throw new Error('UNAUTHORIZED');
    return decoded.sub;
  } catch (e: any) {
    if (e?.message === 'MISSING_JWT_SECRET') throw e;
    throw new Error('UNAUTHORIZED');
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}
