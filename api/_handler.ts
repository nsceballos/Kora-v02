/**
 * Kora - Shared request handler
 *
 * Framework-agnostic: takes a parsed action/data payload plus the caller's
 * access token and returns a status + JSON body. Used by both the Vercel
 * serverless function (api/sheets.ts) and the Vite dev middleware, so the
 * behaviour is identical in local development and production.
 */

import { createSheetsClient, handleAction } from './_sheetsCore';
import { getServiceAccountToken, getSpreadsheetId, getAccessGate } from './_serviceAccount';

export interface HandlerRequest {
  action?: string;
  data?: any;
  token?: string | null;
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
  // Optional shared-secret gate (only enforced when KORA_ACCESS_TOKEN is set)
  const gate = getAccessGate();
  if (gate && req.token !== gate) {
    return { status: 401, body: { error: 'UNAUTHORIZED' } };
  }

  if (!req.action) {
    return { status: 400, body: { error: 'MISSING_ACTION' } };
  }

  try {
    const result = await handleAction(getClient(), req.action, req.data);
    return { status: 200, body: result };
  } catch (err: any) {
    const message = err?.message || String(err);

    // Configuration problems → 500 with a clear hint (not retryable client-side)
    if (message.startsWith('MISSING_') || message === 'TOKEN_REQUEST_FAILED') {
      return { status: 500, body: { error: 'SERVER_CONFIG', message } };
    }
    if (message.startsWith('Acción no reconocida')) {
      return { status: 400, body: { error: message } };
    }
    return { status: 502, body: { error: message } };
  }
}
