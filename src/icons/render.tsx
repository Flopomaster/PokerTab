/**
 * עמוד שירות (לא חלק מהאפליקציה): מרנדר את כל נכסי האייקון בגודל מדויק
 * כדי ש-scripts/render-icons.mjs יצלם אותם ל-PNG. ראו README.
 */
import { createRoot } from 'react-dom/client';
import { AppIcon } from './AppIcon';

export const ICON_ASSETS = [
  { id: 'icon-512', size: 512, padded: false },
  { id: 'icon-192', size: 192, padded: false },
  { id: 'icon-maskable-512', size: 512, padded: true },
  { id: 'apple-touch-icon', size: 180, padded: false },
  { id: 'favicon-32', size: 32, padded: false },
];

/** גדלים בפיקסלים אמיתיים של מכשירי iOS נפוצים (לאורך) */
export const SPLASH_ASSETS = [
  { id: 'splash-1290x2796', w: 1290, h: 2796 },
  { id: 'splash-1179x2556', w: 1179, h: 2556 },
  { id: 'splash-1284x2778', w: 1284, h: 2778 },
  { id: 'splash-1170x2532', w: 1170, h: 2532 },
  { id: 'splash-1125x2436', w: 1125, h: 2436 },
  { id: 'splash-1242x2688', w: 1242, h: 2688 },
  { id: 'splash-828x1792', w: 828, h: 1792 },
  { id: 'splash-750x1334', w: 750, h: 1334 },
];

function Splash({ w, h }: { w: number; h: number }) {
  const icon = Math.round(Math.min(w, h) * 0.34);
  return (
    <div
      style={{
        width: w,
        height: h,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Math.round(icon * 0.16),
        // גרדיאנט אנכי בלבד — כל שורת פיקסלים זהה לקודמת, מה שמכווץ
        // את ה-PNG בסדר גודל לעומת גרדיאנט רדיאלי
        background: 'linear-gradient(180deg, #0e2419 0%, #06100c 62%)',
      }}
    >
      <div style={{ borderRadius: icon * 0.224, overflow: 'hidden', lineHeight: 0 }}>
        <AppIcon size={icon} idSuffix={`-s${w}`} />
      </div>
      <div
        style={{
          fontFamily: 'Heebo, system-ui, sans-serif',
          fontWeight: 900,
          fontSize: Math.round(icon * 0.19),
          letterSpacing: '-0.01em',
          color: '#f0b429',
        }}
      >
        PokerTab
      </div>
    </div>
  );
}

function Renderer() {
  return (
    <div>
      {ICON_ASSETS.map((a) => (
        <div className="asset" id={a.id} key={a.id}>
          <AppIcon size={a.size} padded={a.padded} idSuffix={`-${a.id}`} />
        </div>
      ))}
      {SPLASH_ASSETS.map((s) => (
        <div className="asset" id={s.id} key={s.id}>
          <Splash w={s.w} h={s.h} />
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Renderer />);
