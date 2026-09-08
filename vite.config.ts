import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// באתר החי (GitHub Pages) האפליקציה יושבת תחת /PokerTab/, בפיתוח מקומי תחת /.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/PokerTab/' : '/',
}));
