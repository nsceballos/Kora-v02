/**
 * Kora - Google OAuth 2.0 Authentication Service
 * Uses Google Identity Services (GIS) for user authentication
 * and Google API Client (gapi) for Sheets API access.
 *
 * Configuration is read from environment variables (build time):
 *   VITE_GOOGLE_CLIENT_ID
 *   VITE_GOOGLE_SPREADSHEET_ID
 */

declare const google: any;
declare const gapi: any;

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
  accessToken: string;
}

const SESSION_KEY = 'kora_google_session';

// Read config from Vite env vars (injected at build time)
const CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
const SPREADSHEET_ID = (import.meta as any).env?.VITE_GOOGLE_SPREADSHEET_ID || '';

let tokenClient: any = null;
let gapiInited = false;
let gisInited = false;
let currentAccessToken: string | null = null;

let resolveReady: (() => void) | null = null;
const readyPromise = new Promise<void>(r => { resolveReady = r; });

function maybeResolveReady() {
  if (gapiInited && gisInited && resolveReady) {
    resolveReady();
    resolveReady = null;
  }
}

export const googleAuth = {
  /** Get the spreadsheet ID from env config */
  getSpreadsheetId(): string | null {
    return SPREADSHEET_ID || null;
  },

  /** Get the current access token */
  getAccessToken(): string | null {
    return currentAccessToken;
  },

  /** Check if the env vars are configured */
  isConfigured(): boolean {
    return !!(CLIENT_ID && SPREADSHEET_ID);
  },

  /** Initialize Google API Client Library */
  async initGapi() {
    if (typeof gapi === 'undefined') {
      console.warn('gapi not loaded');
      return;
    }
    await new Promise<void>((resolve) => {
      gapi.load('client', async () => {
        await gapi.client.init({});
        await gapi.client.load('sheets', 'v4');
        gapiInited = true;
        maybeResolveReady();
        resolve();
      });
    });
  },

  /** Initialize Google Identity Services */
  initGis() {
    if (!CLIENT_ID) return;

    if (typeof google === 'undefined' || !google.accounts) {
      console.warn('GIS not loaded');
      return;
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: () => {},
    });
    gisInited = true;
    maybeResolveReady();
  },

  /** Wait until both libs are initialized */
  async waitReady() {
    if (!this.isConfigured()) throw new Error('NO_CONFIG');
    await readyPromise;
  },

  /** Request an access token (triggers Google login popup) */
  requestAccessToken(): Promise<GoogleUser> {
    return new Promise((resolve, reject) => {
      if (!tokenClient) {
        reject(new Error('GIS not initialized. Call initGis() first.'));
        return;
      }

      tokenClient.callback = async (tokenResponse: any) => {
        if (tokenResponse.error) {
          reject(new Error(tokenResponse.error));
          return;
        }

        currentAccessToken = tokenResponse.access_token;

        if (gapiInited) {
          gapi.client.setToken({ access_token: tokenResponse.access_token });
        }

        try {
          const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
          });
          const profile = await res.json();

          const user: GoogleUser = {
            id: profile.id,
            email: profile.email,
            name: profile.name || profile.email.split('@')[0],
            picture: profile.picture || '',
            accessToken: tokenResponse.access_token,
          };

          sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
          resolve(user);
        } catch (e) {
          reject(e);
        }
      };

      tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  },

  /** Try to restore a previous session (silent re-auth) */
  async tryRestoreSession(): Promise<GoogleUser | null> {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const user = JSON.parse(raw) as GoogleUser;

      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${user.accessToken}` }
      });

      if (res.ok) {
        currentAccessToken = user.accessToken;
        if (gapiInited && typeof gapi !== 'undefined') {
          gapi.client.setToken({ access_token: user.accessToken });
        }
        return user;
      }

      sessionStorage.removeItem(SESSION_KEY);
      return null;
    } catch {
      return null;
    }
  },

  /** Logout */
  logout() {
    if (currentAccessToken && typeof google !== 'undefined' && google.accounts) {
      google.accounts.oauth2.revoke(currentAccessToken);
    }
    currentAccessToken = null;
    sessionStorage.removeItem(SESSION_KEY);
  },
};
