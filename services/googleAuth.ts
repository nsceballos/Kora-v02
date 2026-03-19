/**
 * Kora - Google OAuth 2.0 Authentication Service
 * Uses Google Identity Services (GIS) for user authentication
 * and Google API Client (gapi) for Sheets API access.
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

interface KoraConfig {
  clientId: string;
  spreadsheetId: string;
}

const CONFIG_KEY = 'kora_google_config';
const SESSION_KEY = 'kora_google_session';

let tokenClient: any = null;
let gapiInited = false;
let gisInited = false;
let currentAccessToken: string | null = null;

// Resolve when both gapi and gis are ready
let resolveReady: (() => void) | null = null;
const readyPromise = new Promise<void>(r => { resolveReady = r; });

function maybeResolveReady() {
  if (gapiInited && gisInited && resolveReady) {
    resolveReady();
    resolveReady = null;
  }
}

export const googleAuth = {
  /** Save configuration (Client ID + Spreadsheet ID) */
  saveConfig(config: KoraConfig) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  },

  /** Get saved configuration */
  getConfig(): KoraConfig | null {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (!raw) return null;
      const config = JSON.parse(raw) as KoraConfig;
      if (config.clientId && config.spreadsheetId) return config;
      return null;
    } catch {
      return null;
    }
  },

  /** Get the current access token */
  getAccessToken(): string | null {
    return currentAccessToken;
  },

  /** Get the spreadsheet ID from config */
  getSpreadsheetId(): string | null {
    return this.getConfig()?.spreadsheetId || null;
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
    const config = this.getConfig();
    if (!config?.clientId) return;

    if (typeof google === 'undefined' || !google.accounts) {
      console.warn('GIS not loaded');
      return;
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: config.clientId,
      scope: SCOPES,
      callback: () => {}, // Will be set dynamically per request
    });
    gisInited = true;
    maybeResolveReady();
  },

  /** Wait until both libs are initialized */
  async waitReady() {
    const config = this.getConfig();
    if (!config) throw new Error('NO_CONFIG');
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

        // Set the token in gapi client
        if (gapiInited) {
          gapi.client.setToken({ access_token: tokenResponse.access_token });
        }

        // Fetch user profile
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

          // Save session
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

      // Verify the token is still valid
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

      // Token expired
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

  /** Check if configured */
  isConfigured(): boolean {
    return this.getConfig() !== null;
  },
};
