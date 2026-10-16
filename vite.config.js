import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Nastavení Vite.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.APP_API_URL || env.VITE_API_URL;
  const apiKey = env.APP_API_KEY || env.VITE_API_KEY;
  const proxy = target && apiKey ? {
    '/api': {
      target, changeOrigin: true,
      configure(server) {
        server.on('proxyReq', request => request.setHeader('X-Api-Key', apiKey));
      },
    },
  } : undefined;
  const missingConfiguration = server => {
    server.middlewares.use('/api', (_request, response) => {
      response.statusCode = 503;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ error: { code: 'proxy_not_configured' } }));
    });
  };

  return {
    // Podpora Reactu (JSX, rychlé obnovování při vývoji).
    plugins: [react(), ...(!proxy ? [{
      name: 'missing-api-configuration',
      configureServer: missingConfiguration,
      configurePreviewServer: missingConfiguration,
    }] : [])],

    server: {
      proxy,
    },
    preview: { proxy },
  };
});
