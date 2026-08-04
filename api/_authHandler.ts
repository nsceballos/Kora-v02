/**
 * Kora - Shared auth request handler
 *
 * Framework-agnostic register/login logic, mirroring api/_handler.ts. Used by
 * both the Vercel serverless function (api/auth.ts) and the Vite dev
 * middleware so behaviour is identical locally and in production.
 */

import { createSheetsClient } from './_sheetsCore';
import { getServiceAccountToken, getSpreadsheetId } from './_serviceAccount';
import { signSessionToken, hashPassword, comparePassword } from './_auth';

export interface AuthHandlerRequest {
  action?: 'register' | 'login';
  data?: { name?: string; email?: string; password?: string };
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function configErrorStatus(message: string): HandlerResult | null {
  if (message.startsWith('MISSING_') || message === 'TOKEN_REQUEST_FAILED') {
    return { status: 500, body: { error: 'SERVER_CONFIG', message } };
  }
  return null;
}

export async function handleAuthRequest(req: AuthHandlerRequest): Promise<HandlerResult> {
  const { action, data } = req;

  if (action === 'register') {
    const name = (data?.name || '').trim();
    const email = (data?.email || '').trim().toLowerCase();
    const password = data?.password || '';

    if (!name) return { status: 400, body: { error: 'El nombre es obligatorio.' } };
    if (!EMAIL_RE.test(email)) return { status: 400, body: { error: 'Ingresá un email válido.' } };
    if (password.length < 6) return { status: 400, body: { error: 'La contraseña debe tener al menos 6 caracteres.' } };

    try {
      const existing = await getClient().findUserByEmail(email);
      if (existing) return { status: 409, body: { error: 'Ya existe una cuenta con ese email.' } };

      const passwordHash = await hashPassword(password);
      const user = await getClient().createUser({ name, email, passwordHash });
      const token = signSessionToken(user.id);
      return { status: 201, body: { token, user } };
    } catch (err: any) {
      const message = err?.message || String(err);
      return configErrorStatus(message) ?? { status: 502, body: { error: message } };
    }
  }

  if (action === 'login') {
    const email = (data?.email || '').trim().toLowerCase();
    const password = data?.password || '';

    if (!EMAIL_RE.test(email) || !password) {
      return { status: 400, body: { error: 'Ingresá tu email y contraseña.' } };
    }

    try {
      const user = await getClient().findUserByEmail(email);
      const ok = user ? await comparePassword(password, user.passwordHash) : false;
      if (!user || !ok) {
        // Generic message — don't reveal whether the email exists.
        return { status: 401, body: { error: 'Email o contraseña incorrectos.' } };
      }

      const token = signSessionToken(String(user.id));
      return { status: 200, body: { token, user: getClient().publicUser(user) } };
    } catch (err: any) {
      const message = err?.message || String(err);
      return configErrorStatus(message) ?? { status: 502, body: { error: message } };
    }
  }

  return { status: 400, body: { error: 'MISSING_ACTION' } };
}
