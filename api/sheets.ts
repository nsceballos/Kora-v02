/**
 * Kora - Vercel serverless function: POST /api/sheets
 *
 * Single action-based endpoint backed by a Google service account.
 * Body: { action: string, data?: any }
 * Auth: optional shared token via the "x-kora-token" header (see KORA_ACCESS_TOKEN).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleRequest } from './_handler';

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

  const tokenHeader = req.headers['x-kora-token'];
  const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;

  const { status, body } = await handleRequest({
    action: payload.action,
    data: payload.data,
    token: token ?? null,
  });

  res.status(status).json(body);
}
