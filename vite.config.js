import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Nastavení Vite: jen zapneme podporu Reactu (JSX, rychlé obnovování při vývoji).
export default defineConfig({
  plugins: [react()],
});
