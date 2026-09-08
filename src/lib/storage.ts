export const PLAYER_COLORS = [
  '#f0b429', '#37d67a', '#4dabf7', '#ff6b6b', '#b197fc',
  '#ffa94d', '#63e6be', '#f783ac', '#a9e34b', '#74c0fc',
];

export const PLAYER_EMOJIS = ['🃏', '♠️', '♥️', '♣️', '♦️', '🎩', '🦈', '🐺', '🦊', '🐉', '🎰', '💎', '🚀', '🍀', '👑', '🧿'];

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function randomColor(): string {
  return PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
}

export function randomEmoji(): string {
  return PLAYER_EMOJIS[Math.floor(Math.random() * PLAYER_EMOJIS.length)];
}

/* ------------------------------------------------------------------ */
/* נתונים מהגרסה המקומית הישנה — נשמרים רק כדי לאפשר העלאה חד-פעמית לקלאב */
/* ------------------------------------------------------------------ */

const LEGACY_KEY = 'pokertab.data.v1';

export interface LegacyPlayer {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
}

export interface LegacyGame {
  id: string;
  date: string;
  title?: string;
  location?: string;
  notes?: string;
  buyInAmount: number;
  entries: { playerId: string; buyIns: number; extraBuyIn: number; cashOut: number }[];
  paidTransfers?: string[];
  createdAt?: string;
}

export interface LegacyData {
  players: LegacyPlayer[];
  games: LegacyGame[];
  settings?: { groupName?: string; defaultBuyIn?: number };
}

export function readLegacyData(): LegacyData | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LegacyData;
    if (!Array.isArray(parsed.players) || !Array.isArray(parsed.games)) return null;
    if (parsed.games.length === 0 && parsed.players.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLegacyData(): void {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* מתעלמים */
  }
}

export function exportJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
