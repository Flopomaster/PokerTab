/**
 * אייקון האפליקציה — ז׳יטון פוקר עם ספייד זהב.
 * מקור האמת לכל קבצי ה-PNG שב-public/icons (ראו scripts/render-icons.mjs).
 * viewBox 512×512 ומלא מקצה לקצה: iOS ואנדרואיד מעגלים את הפינות בעצמם.
 */

interface Props {
  size?: number;
  /** גרסה מוקטנת עם שוליים — ל-maskable icon של אנדרואיד */
  padded?: boolean;
  /** מזהה ייחודי לגרדיאנטים, כשמציגים כמה עותקים באותו עמוד */
  idSuffix?: string;
}

const SPADE =
  'M256 62 C256 62 102 205 102 297 C102 358 148 399 199 399 C224 399 245 389 256 374 C256 374 251 430 215 461 L297 461 C261 430 256 374 256 374 C267 389 288 399 313 399 C364 399 410 358 410 297 C410 205 256 62 256 62 Z';

const SPOTS = [0, 45, 90, 135, 180, 225, 270, 315];

export function AppIcon({ size = 512, padded = false, idSuffix = '' }: Props) {
  const id = `pt-icon${idSuffix}`;
  const scale = padded ? 0.76 : 1;

  return (
    <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#123326" />
          <stop offset="100%" stopColor="#050d09" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe6a8" />
          <stop offset="45%" stopColor="#f0b429" />
          <stop offset="100%" stopColor="#b57d10" />
        </linearGradient>
      </defs>

      <rect width="512" height="512" fill={`url(#${id}-bg)`} />

      <g transform={`translate(256 256) scale(${scale}) translate(-256 -256)`}>
        <circle cx="256" cy="256" r="196" fill="#0d2119" stroke={`url(#${id}-gold)`} strokeWidth="18" />
        {SPOTS.map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const cx = 256 + Math.cos(rad) * 178;
          const cy = 256 + Math.sin(rad) * 178;
          return (
            <rect
              key={deg}
              x={cx - 20}
              y={cy - 32}
              width="40"
              height="64"
              rx="10"
              fill={`url(#${id}-gold)`}
              transform={`rotate(${deg + 90} ${cx} ${cy})`}
            />
          );
        })}
        <circle cx="256" cy="256" r="132" fill="#081611" stroke="rgba(240,180,41,0.55)" strokeWidth="8" />
        <g transform="translate(256 262) scale(0.62) translate(-256 -262)">
          <path d={SPADE} fill={`url(#${id}-gold)`} />
        </g>
      </g>
    </svg>
  );
}
