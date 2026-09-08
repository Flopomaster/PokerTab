/**
 * מייצר את כל קבצי ה-PNG שב-public/icons מתוך קומפוננטת האייקון (src/icons/AppIcon.tsx).
 *
 * שימוש:
 *   npm run dev                # בטרמינל אחד
 *   node scripts/render-icons.mjs
 *
 * דורש playwright מותקן גלובלית או ב-npx, עם דפדפן chromium.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const URL = process.env.RENDER_URL ?? 'http://127.0.0.1:5173/icon-render.html';
const OUT = new URL('../public/icons/', import.meta.url).pathname;

const ASSETS = [
  'icon-512', 'icon-192', 'icon-maskable-512', 'apple-touch-icon', 'favicon-32',
  'splash-1290x2796', 'splash-1179x2556', 'splash-1284x2778', 'splash-1170x2532',
  'splash-1125x2436', 'splash-1242x2688', 'splash-828x1792', 'splash-750x1334',
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

for (const id of ASSETS) {
  await page.locator(`#${id}`).screenshot({ path: `${OUT}${id}.png` });
  console.log('✓', `${id}.png`);
}

await browser.close();
