import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Dev-only middleware that serves POST /api/sheets and POST /api/auth
 * locally, mirroring the Vercel serverless functions so `npm run dev`
 * behaves like production. In production Vercel runs api/sheets.ts and
 * api/auth.ts directly and this plugin is unused.
 */
function devApiPlugin(): Plugin {
  return {
    name: 'kora-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/sheets', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
          return;
        }
        try {
          let raw = '';
          for await (const chunk of req) raw += chunk;
          const payload = raw ? JSON.parse(raw) : {};
          const authHeader = req.headers['authorization'];

          // Imported lazily so a missing google-auth-library never breaks dev startup.
          const { handleRequest } = await import('./api/_handler');
          const { status, body } = await handleRequest({
            action: payload.action,
            data: payload.data,
            authHeader: Array.isArray(authHeader) ? authHeader[0] : authHeader ?? null,
          });
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'DEV_API_ERROR', message: e?.message }));
        }
      });

      server.middlewares.use('/api/auth', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
          return;
        }
        try {
          let raw = '';
          for await (const chunk of req) raw += chunk;
          const payload = raw ? JSON.parse(raw) : {};

          const { handleAuthRequest } = await import('./api/_authHandler');
          const { status, body } = await handleAuthRequest({
            action: payload.action,
            data: payload.data,
          });
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'DEV_API_ERROR', message: e?.message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Expose non-VITE_ env vars (service-account secrets) to the dev middleware.
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }

  return {
    plugins: [react(), tailwindcss(), devApiPlugin()],
    server: {
      host: true,
      port: 3000,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
