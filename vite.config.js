import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Nastavení Vite.
export default defineConfig(({ mode }) => {
  // Načteme proměnné ze souboru .env.local (např. VITE_API_URL).
  const env = loadEnv(mode, process.cwd());

  return {
    // Podpora Reactu (JSX, rychlé obnovování při vývoji).
    plugins: [react()],

    server: {
      // PROXY: při vývoji appka volá "/api/..." na svém vlastním serveru
      // a Vite to přepošle na backend. Prohlížeč si tak myslí, že mluví
      // se stejnou adresou → nevadí mu CORS a appka funguje i na mobilu
      // otevřeném přes Wi-Fi (http://192.168.x.x:5173).
      proxy: {
        '/api': {
          target: env.VITE_API_URL,
          changeOrigin: true,
        },
      },
    },
  };
});
