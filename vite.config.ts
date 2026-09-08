import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// מזהה בנייה: משמש להשוואה בין הגרסה שרצה בדפדפן לגרסה שעל השרת
const BUILD_ID = new Date().toISOString();

/** כותב version.json לצד האתר, כדי שהאפליקציה תוכל לזהות שיצאה גרסה חדשה. */
function versionFile() {
  return {
    name: 'pokertab-version-file',
    generateBundle(this: { emitFile: (f: { type: 'asset'; fileName: string; source: string }) => void }) {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ build: BUILD_ID }),
      });
    },
  };
}

// באתר החי (GitHub Pages) האפליקציה יושבת תחת /PokerTab/, בפיתוח מקומי תחת /.
export default defineConfig(({ mode }) => ({
  plugins: [react(), versionFile()],
  base: mode === 'production' ? '/PokerTab/' : '/',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
}));
