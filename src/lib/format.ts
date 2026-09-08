/** עיגול לשתי ספרות אחרי הנקודה, בלי רעשי float. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * ₪1,250 / -₪150. הסכום עטוף ב־LRI/PDI כדי שסימן המינוס והמטבע
 * יישארו בצד הנכון גם בתוך משפט בעברית (RTL).
 */
const LRI = '\u2066';
const PDI = '\u2069';

function isolate(s: string): string {
  return `${LRI}${s}${PDI}`;
}

export function money(n: number): string {
  const v = round2(n);
  const abs = Math.abs(v).toLocaleString('he-IL', { maximumFractionDigits: 2 });
  return isolate(`${v < 0 ? '-' : ''}₪${abs}`);
}

/** כמו money אבל עם + מפורש לרווח — לשימוש במאזנים. */
export function signedMoney(n: number): string {
  const v = round2(n);
  const abs = Math.abs(v).toLocaleString('he-IL', { maximumFractionDigits: 2 });
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  return isolate(`${sign}₪${abs}`);
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateLong(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function todayISO(): string {
  const d = new Date();
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const RANK_LABELS = ['🥇', '🥈', '🥉'];
export function rankBadge(rank: number): string {
  return RANK_LABELS[rank - 1] ?? `${rank}`;
}

export function ordinalHe(rank: number): string {
  const names = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שביעי', 'שמיני', 'תשיעי', 'עשירי'];
  return names[rank - 1] ? `מקום ${names[rank - 1]}` : `מקום ${rank}`;
}
