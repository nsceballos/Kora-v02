/**
 * Kora - Google service-account authentication (server-side only)
 *
 * Reads credentials from environment variables (configured in Vercel) and
 * mints short-lived access tokens for the Google Sheets API. The private key
 * NEVER reaches the browser.
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  - client_email of the service account
 *   GOOGLE_PRIVATE_KEY            - private_key (with real or escaped \n)
 *   GOOGLE_SHEET_ID              - target spreadsheet id (GOOGLE_SPREADSHEET_ID also accepted)
 * Optional:
 *   KORA_ACCESS_TOKEN            - if set, the API requires this shared token
 */

import { JWT } from 'google-auth-library';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let cachedClient: JWT | null = null;

export function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SPREADSHEET_ID;
  if (!id) throw new Error('MISSING_SPREADSHEET_ID');
  return id;
}

export function getAccessGate(): string | null {
  const token = process.env.KORA_ACCESS_TOKEN;
  return token && token.trim() ? token.trim() : null;
}

function buildClient(): JWT {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !key) throw new Error('MISSING_SERVICE_ACCOUNT_CREDENTIALS');

  // Vercel stores multiline secrets with escaped newlines; normalize them.
  key = key.replace(/\\n/g, '\n');
  // Strip accidental wrapping quotes.
  if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1).replace(/\\n/g, '\n');

  return new JWT({ email, key, scopes: SCOPES });
}

/** Get a valid OAuth access token for the service account (cached + auto-refreshed). */
export async function getServiceAccountToken(): Promise<string> {
  if (!cachedClient) cachedClient = buildClient();
  const res = await cachedClient.getAccessToken();
  if (!res || !res.token) throw new Error('TOKEN_REQUEST_FAILED');
  return res.token;
}
