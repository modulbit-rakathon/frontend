import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Nastavení Vite.
export default defineConfig(({ mode }) => {
  // Načteme proměnné ze souboru .env.local (např. VITE_API_URL).
  const env = loadEnv(mode, process.cwd());

  return {
    plugins: [
      // Podpora Reactu (JSX, rychlé obnovování při vývoji).
      react(),

      // PWA: appku jde "nainstalovat" na plochu a funguje i bez internetu.
      // Service worker (Workbox) si při první návštěvě uloží celou appku
      // (HTML, JS, CSS, písma, ikony). Data pacienta jsou v localStorage.
      VitePWA({
        // Nová verze se nenačte sama uprostřed práce – appka nabídne
        // "Načíst novou verzi" (src/offline/AppStatus.jsx).
        registerType: 'prompt',
        // Service worker registrujeme sami přes useRegisterSW v AppStatus.jsx.
        injectRegister: false,
        // Ikony a favicon už bere globPatterns níže → nepřidávat podruhé.
        includeManifestIcons: false,
        manifest: {
          name: 'PillGaze – moje léky',
          short_name: 'PillGaze',
          description: 'Vyfoťte své léky a ukažte jejich seznam lékaři.',
          lang: 'cs',
          dir: 'ltr',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          // Barvy z src/index.css (--bg = bílé pozadí, stejné jako theme-color v index.html)
          theme_color: '#ffffff',
          background_color: '#ffffff',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            // "maskable" = Android si ikonu ořízne do kruhu/čtverce, logo je uprostřed s okrajem
            { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Co se uloží do telefonu: všechno, co vznikne při buildu, i písma a ikony z public/.
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          // Jakákoli adresa appky (/leky, /zprava, /doc…) bez internetu → index.html, React si poradí.
          navigateFallback: '/index.html',
          // Volání backendu se NIKDY neukládají (fotky, PIN, data pacienta, API klíč v hlavičce).
          navigateFallbackDenylist: [/^\/api\//],
          // Staré verze uložené appky po aktualizaci smažeme.
          cleanupOutdatedCaches: true,
          // Při první instalaci převezme service worker stránku hned, ať appka
          // funguje offline i bez dalšího obnovení. Novou verzi ale aktivuje až pacient.
          clientsClaim: true,
          // runtimeCaching schválně nenastavujeme: API se do mezipaměti service workeru
          // neukládá. Hledání v katalogu bez internetu řeší src/offline/catalogCache.js.
        },
        // Při vývoji (npm run dev) service worker nezapínáme – jinak by držel staré soubory.
        devOptions: { enabled: false },
      }),
    ],

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
