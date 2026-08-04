/**
 * Kora - Vercel serverless function: POST /api/auth
 *
 * Registro e inicio de sesión de usuarios. No requiere token de sesión (es
 * justamente donde se emite). Body: { action: 'register' | 'login', data }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAuthRequest } from './_authHandler.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  let payload: any = req.body;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload || '{}'); } catch { payload = {}; }
  }
  payload = payload || {};

  const { status, body } = await handleAuthRequest({
    action: payload.action,
    data: payload.data,
  });

  res.status(status).json(body);
}
