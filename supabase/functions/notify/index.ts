/*
 * שליחת התראות Web Push לחברי הקלאב.
 * ההצפנה ממומשת כאן ידנית מול WebCrypto לפי RFC 8291 (aes128gcm) ו-VAPID,
 * כדי לא להיות תלויים בספרייה חיצונית בסביבת Deno.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id: string;
}

interface Message {
  userId: string;
  title: string;
  body: string;
}

const enc = new TextEncoder();

const b64urlToBytes = (s: string): Uint8Array => {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const bytesToB64url = (b: Uint8Array): string =>
  btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

/** JWK של מפתח VAPID, נגזר מהמפתחות הגולמיים ששמורים ב-app_secrets */
function vapidJwk(publicRaw: Uint8Array, privateRaw?: Uint8Array): JsonWebKey {
  const x = bytesToB64url(publicRaw.slice(1, 33));
  const y = bytesToB64url(publicRaw.slice(33, 65));
  return privateRaw
    ? { kty: 'EC', crv: 'P-256', x, y, d: bytesToB64url(privateRaw), ext: true }
    : { kty: 'EC', crv: 'P-256', x, y, ext: true };
}

/** חתימת ה-JWT של VAPID (ES256) עבור מוצא היעד */
async function vapidHeader(endpoint: string, publicRaw: Uint8Array, privateRaw: Uint8Array, subject: string) {
  const aud = new URL(endpoint).origin;
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = bytesToB64url(
    enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })),
  );
  const signingInput = `${header}.${payload}`;

  const key = await crypto.subtle.importKey('jwk', vapidJwk(publicRaw, privateRaw), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(signingInput)),
  );
  return `vapid t=${signingInput}.${bytesToB64url(sig)}, k=${bytesToB64url(publicRaw)}`;
}

/** הצפנת המטען לפי RFC 8291 */
async function encryptPayload(payload: string, uaPublicRaw: Uint8Array, authSecret: Uint8Array) {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const asKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));

  const uaKey = await crypto.subtle.importKey('raw', uaPublicRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));

  // IKM: HKDF עם salt=auth_secret ומידע שכולל את שני המפתחות הציבוריים
  const sharedKey = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveBits']);
  const keyInfo = concat(enc.encode('WebPush: info'), new Uint8Array([0]), uaPublicRaw, asPublicRaw);
  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: keyInfo }, sharedKey, 256),
  );

  const ikmKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const cekBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: concat(enc.encode('Content-Encoding: aes128gcm'), new Uint8Array([0])) },
    ikmKey,
    128,
  );
  const nonceBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: concat(enc.encode('Content-Encoding: nonce'), new Uint8Array([0])) },
    ikmKey,
    96,
  );

  const cek = await crypto.subtle.importKey('raw', cekBits, { name: 'AES-GCM' }, false, ['encrypt']);
  const plaintext = concat(enc.encode(payload), new Uint8Array([2])); // 0x02 = הרשומה האחרונה
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: new Uint8Array(nonceBits) }, cek, plaintext),
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublicRaw.length]), asPublicRaw, ciphertext);
}

async function sendPush(sub: PushSubscriptionRow, message: { title: string; body: string }, vapid: { pub: Uint8Array; priv: Uint8Array; subject: string }) {
  const body = await encryptPayload(JSON.stringify(message), b64urlToBytes(sub.p256dh), b64urlToBytes(sub.auth));
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'normal',
      Authorization: await vapidHeader(sub.endpoint, vapid.pub, vapid.priv, vapid.subject),
    },
    body,
  });
  return res.status;
}

/* הדפדפן שולח preflight לפני הקריאה האמיתית — בלי הכותרות האלה הוא לא ישלח אותה כלל */
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors } });

/** מזהה המשתמש מתוך ה-JWT. הפלטפורמה כבר אימתה את החתימה (verify_jwt). */
function callerId(req: Request): string | null {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(token.split('.')[1])));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

async function buildMessages(db: SupabaseClient, type: string, clubId: string, gameId: string | null, caller: string): Promise<Message[]> {
  const { data: club } = await db.from('clubs').select('name').eq('id', clubId).single();
  const clubName = club?.name ?? 'הקלאב';
  const { data: me } = await db.from('profiles').select('display_name').eq('id', caller).single();
  const myName = me?.display_name ?? 'מישהו';

  if (type === 'join_request') {
    const { data: admins } = await db
      .from('club_members')
      .select('user_id')
      .eq('club_id', clubId)
      .eq('role', 'admin')
      .eq('status', 'approved');
    return (admins ?? [])
      .filter((a) => a.user_id !== caller)
      .map((a) => ({
        userId: a.user_id as string,
        title: `⏳ בקשת הצטרפות ל${clubName}`,
        body: `${myName} מבקש להצטרף. פתחו את PokerTab כדי לאשר.`,
      }));
  }

  if (type === 'table_opened') {
    const { data: members } = await db
      .from('club_members')
      .select('user_id')
      .eq('club_id', clubId)
      .eq('status', 'approved');
    return (members ?? [])
      .filter((m) => m.user_id !== caller)
      .map((m) => ({
        userId: m.user_id as string,
        title: `🎲 נפתח שולחן ב${clubName}`,
        body: `${myName} פתח שולחן עכשיו. מי בא?`,
      }));
  }

  if (type === 'table_closed' && gameId) {
    const { data: game } = await db.from('games').select('buy_in_amount').eq('id', gameId).single();
    const buyIn = Number(game?.buy_in_amount ?? 0);
    const { data: entries } = await db
      .from('game_entries')
      .select('buy_ins, extra_buy_in, cash_out, players(user_id)')
      .eq('game_id', gameId);

    const out: Message[] = [];
    for (const e of entries ?? []) {
      const player = Array.isArray(e.players) ? e.players[0] : e.players;
      const userId = player?.user_id as string | null;
      if (!userId || userId === caller) continue;
      const spent = Number(e.buy_ins) * buyIn + Number(e.extra_buy_in);
      const net = Math.round((Number(e.cash_out) - spent) * 100) / 100;
      const amount = `₪${Math.abs(net).toLocaleString('he-IL')}`;
      out.push({
        userId,
        title: `🏁 השולחן ב${clubName} נסגר`,
        body: net > 0 ? `סיימת ברווח של ${amount}` : net < 0 ? `סיימת בהפסד של ${amount}` : 'סיימת באפס',
      });
    }
    return out;
  }

  return [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const caller = callerId(req);
  if (!caller) return json({ error: 'unauthenticated' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  const serviceKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? (secretKeys ? JSON.parse(secretKeys).default : undefined);
  if (!url || !serviceKey) return json({ error: 'server not configured' }, 500);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  let payload: { type?: string; clubId?: string; gameId?: string | null };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  const { type, clubId, gameId = null } = payload;
  if (!type || !clubId) return json({ error: 'missing type or clubId' }, 400);

  // המזמין חייב להיות קשור לקלאב — חבר מאושר, או מבקש הצטרפות
  const { data: membership } = await db
    .from('club_members')
    .select('status')
    .eq('club_id', clubId)
    .eq('user_id', caller)
    .maybeSingle();
  const allowed = type === 'join_request' ? !!membership : membership?.status === 'approved';
  if (!allowed) return json({ error: 'forbidden' }, 403);

  const messages = await buildMessages(db, type, clubId, gameId, caller);
  if (messages.length === 0) return json({ sent: 0, note: 'no recipients' });

  const { data: secrets } = await db.from('app_secrets').select('key, value');
  const secretMap = new Map((secrets ?? []).map((s) => [s.key as string, s.value as string]));
  const pub = secretMap.get('vapid_public');
  const priv = secretMap.get('vapid_private');
  if (!pub || !priv) return json({ error: 'vapid keys missing' }, 500);
  const vapid = {
    pub: b64urlToBytes(pub),
    priv: b64urlToBytes(priv),
    subject: secretMap.get('vapid_subject') ?? 'mailto:admin@pokertab.app',
  };

  const userIds = [...new Set(messages.map((m) => m.userId))];
  const { data: subs } = await db.from('push_subscriptions').select('*').in('user_id', userIds);

  let sent = 0;
  const gone: string[] = [];
  for (const sub of (subs ?? []) as PushSubscriptionRow[]) {
    const message = messages.find((m) => m.userId === sub.user_id);
    if (!message) continue;
    try {
      const status = await sendPush(sub, { title: message.title, body: message.body }, vapid);
      if (status === 404 || status === 410) gone.push(sub.endpoint);
      else if (status >= 200 && status < 300) sent++;
      else console.error('push failed', status, sub.endpoint.slice(0, 60));
    } catch (e) {
      console.error('push error', String(e));
    }
  }

  // מנויים שכבר לא קיימים — מנקים כדי שלא ננסה שוב
  if (gone.length > 0) await db.from('push_subscriptions').delete().in('endpoint', gone);

  return json({ sent, recipients: messages.length, removed: gone.length });
});
