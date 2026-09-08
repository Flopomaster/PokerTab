import type { AppData, Game, Player } from '../types';

const KEY = 'pokertab.data.v1';
export const DATA_VERSION = 1;

export const PLAYER_COLORS = [
  '#f0b429', '#37d67a', '#4dabf7', '#ff6b6b', '#b197fc',
  '#ffa94d', '#63e6be', '#f783ac', '#a9e34b', '#74c0fc',
];

export const PLAYER_EMOJIS = ['🃏', '♠️', '♥️', '♣️', '♦️', '🎩', '🦈', '🐺', '🦊', '🐉', '🎰', '💎', '🚀', '🍀', '👑', '🧿'];

export function emptyData(): AppData {
  return {
    version: DATA_VERSION,
    players: [],
    games: [],
    settings: { groupName: 'הקבוצה שלי', defaultBuyIn: 100 },
  };
}

function isPlayer(p: unknown): p is Player {
  return !!p && typeof p === 'object' && typeof (p as Player).id === 'string' && typeof (p as Player).name === 'string';
}

function isGame(g: unknown): g is Game {
  return !!g && typeof g === 'object' && typeof (g as Game).id === 'string' && Array.isArray((g as Game).entries);
}

/** מנקה ומשלים שדות חסרים — כדי שגם קובץ ישן/ידני ייטען בלי לשבור. */
export function normalize(raw: unknown): AppData {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  const data = raw as Partial<AppData>;

  const players: Player[] = Array.isArray(data.players)
    ? data.players.filter(isPlayer).map((p, i) => ({
        id: p.id,
        name: p.name,
        emoji: p.emoji || PLAYER_EMOJIS[i % PLAYER_EMOJIS.length],
        color: p.color || PLAYER_COLORS[i % PLAYER_COLORS.length],
        createdAt: p.createdAt || new Date().toISOString(),
        archived: !!p.archived,
      }))
    : [];

  const playerIds = new Set(players.map((p) => p.id));

  const games: Game[] = Array.isArray(data.games)
    ? data.games.filter(isGame).map((g) => ({
        id: g.id,
        date: g.date || new Date().toISOString().slice(0, 10),
        title: g.title || '',
        location: g.location || '',
        notes: g.notes || '',
        buyInAmount: Number(g.buyInAmount) || 0,
        entries: (g.entries || [])
          .filter((e) => playerIds.has(e.playerId))
          .map((e) => ({
            playerId: e.playerId,
            buyIns: Number(e.buyIns) || 0,
            extraBuyIn: Number(e.extraBuyIn) || 0,
            cashOut: Number(e.cashOut) || 0,
          })),
        paidTransfers: Array.isArray(g.paidTransfers) ? g.paidTransfers.filter((x) => typeof x === 'string') : [],
        createdAt: g.createdAt || new Date().toISOString(),
      }))
    : [];

  return {
    version: DATA_VERSION,
    players,
    games,
    settings: {
      groupName: data.settings?.groupName || base.settings.groupName,
      defaultBuyIn: Number(data.settings?.defaultBuyIn) || base.settings.defaultBuyIn,
    },
  };
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyData();
    return normalize(JSON.parse(raw));
  } catch {
    return emptyData();
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // מצב פרטי / אחסון מלא — לא מפילים את האפליקציה
  }
}

export function exportToFile(data: AppData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pokertab-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
