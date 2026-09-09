import { api } from './apiClient';

/**
 * מפתח VAPID הציבורי. נועד להיחשף — הוא נשלח לשירותי הפוש של אפל וגוגל
 * כדי שיוכלו לאמת שההתראה הגיעה מהשרת שלנו. המפתח הפרטי יושב בשרת בלבד.
 */
const VAPID_PUBLIC = 'BBr-Ell8N3hXOr4jkkC0fsoe00artCE8-bAyaCoTb6SJffbrKYpfDH7hkL-xxJexHhnkbAFw39cMw5HL9WgDDw4';

export type PushState = 'unsupported' | 'default' | 'granted' | 'denied';

const b64ToBytes = (s: string): ArrayBuffer => {
  const padded = (s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
};

const bytesToB64url = (buf: ArrayBuffer | null): string => {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export function pushSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** באייפון התראות עובדות רק כשהאפליקציה הותקנה למסך הבית */
export function needsInstallFirst(): boolean {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return isIOS && !standalone;
}

export function pushState(): PushState {
  if (!pushSupported()) return 'unsupported';
  return Notification.permission as PushState;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  if (existing) return existing;
  return navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
}

export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  try {
    const reg = await registration();
    return !!(await reg.pushManager.getSubscription());
  } catch {
    return false;
  }
}

/** מבקש הרשאה, נרשם לפוש ושומר את המנוי בשרת. */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission as PushState;

  const reg = await registration();
  await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64ToBytes(VAPID_PUBLIC),
    }));

  await api.savePushSubscription({
    endpoint: sub.endpoint,
    p256dh: bytesToB64url(sub.getKey('p256dh')),
    auth: bytesToB64url(sub.getKey('auth')),
    userAgent: navigator.userAgent.slice(0, 200),
  });

  return 'granted';
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await registration();
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await api.removePushSubscription(sub.endpoint).catch(() => undefined);
  await sub.unsubscribe();
}
