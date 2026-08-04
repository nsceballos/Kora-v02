/**
 * Kora - Vercel serverless function: POST /api/sheets
 *
 * Single action-based endpoint backed by a Google service account.
 * Body: { action: string, data?: any }
 * Auth: requiere `Authorization: Bearer <token>` (token de sesión emitido por
 * POST /api/auth al registrarse o iniciar sesión). Sin token válido, 401.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleRequest } from './_handler.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  // Body may arrive parsed (Vercel) or as a raw string.
  let payload: any = req.body;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload || '{}'); } catch { payload = {}; }
  }
  payload = payload || {};

  const authHeader = req.headers['authorization'];

  const { status, body } = await handleRequest({
    action: payload.action,
    data: payload.data,
    authHeader: Array.isArray(authHeader) ? authHeader[0] : authHeader ?? null,
  });

  res.status(status).json(body);
}
