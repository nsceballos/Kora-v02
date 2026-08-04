/**
 * Kora - Shared request handler
 *
 * Framework-agnostic: takes a parsed action/data payload plus the caller's
 * session token and returns a status + JSON body. Used by both the Vercel
 * serverless function (api/sheets.ts) and the Vite dev middleware, so the
 * behaviour is identical in local development and production.
 *
 * Every action here is scoped to the authenticated user (resolved from the
 * `Authorization: Bearer <token>` header) — see api/_auth.ts. There is no
 * action that can read or write another user's rows.
 */

import { createSheetsClient, handleAction } from './_sheetsCore.js';
import { getServiceAccountToken, getSpreadsheetId } from './_serviceAccount.js';
import { getUserIdFromAuthHeader } from './_auth.js';

export interface HandlerRequest {
  action?: string;
  data?: any;
  authHeader?: string | null;
}

export interface HandlerResult {
  status: number;
  body: any;
}

let client: ReturnType<typeof createSheetsClient> | null = null;

function getClient() {
  if (!client) {
    client = createSheetsClient({
      spreadsheetId: getSpreadsheetId(),
      getToken: getServiceAccountToken,
    });
  }
  return client;
}

export async function handleRequest(req: HandlerRequest): Promise<HandlerResult> {
  let userId: string;
  try {
    userId = getUserIdFromAuthHeader(req.authHeader);
  } catch (err: any) {
    const message = err?.message || String(err);
    if (message === 'MISSING_JWT_SECRET') {
      return { status: 500, body: { error: 'SERVER_CONFIG', message } };
    }
    return { status: 401, body: { error: 'UNAUTHORIZED' } };
  }

  if (!req.action) {
    return { status: 400, body: { error: 'MISSING_ACTION' } };
  }

  try {
    const result = await handleAction(getClient(), req.action, userId, req.data);
    return { status: 200, body: result };
  } catch (err: any) {
    const message = err?.message || String(err);

    // Configuration problems → 500 with a clear hint (not retryable client-side)
    if (message.startsWith('MISSING_') || message === 'TOKEN_REQUEST_FAILED') {
      return { status: 500, body: { error: 'SERVER_CONFIG', message } };
    }
    if (message === 'FORBIDDEN') {
      return { status: 403, body: { error: 'FORBIDDEN' } };
    }
    if (message === 'IMPORT_TOO_LARGE') {
      return { status: 400, body: { error: 'El archivo tiene demasiados movimientos. Importá hasta 2000 por vez.' } };
    }
    if (message.startsWith('Acción no reconocida')) {
      return { status: 400, body: { error: message } };
    }
    return { status: 502, body: { error: message } };
  }
}
