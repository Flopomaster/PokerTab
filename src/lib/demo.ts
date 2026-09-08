import type { AppData, Game } from '../types';
import { newId, PLAYER_COLORS, PLAYER_EMOJIS } from './storage';
import { round2 } from './format';

const NAMES = ['יהל', 'דני', 'עומר', 'שירה', 'ניר', 'טל'];

/** נתוני דמו כדי לראות את האפליקציה מלאה לפני שמזינים ערב אמיתי. */
export function buildDemoData(): AppData {
  const players = NAMES.map((name, i) => ({
    id: newId(),
    name,
    emoji: PLAYER_EMOJIS[i % PLAYER_EMOJIS.length],
    color: PLAYER_COLORS[i % PLAYER_COLORS.length],
    createdAt: new Date().toISOString(),
  }));

  const games: Game[] = [];
  const today = new Date();

  for (let g = 9; g >= 0; g--) {
    const date = new Date(today);
    date.setDate(today.getDate() - g * 7);
    const iso = date.toISOString().slice(0, 10);
    const count = 4 + ((g * 3) % 3); // 4-6 שחקנים
    const seated = players.slice(0, count);

    const entries = seated.map((p, idx) => {
      const buyIns = 1 + ((g + idx) % 3);
      return { playerId: p.id, buyIns, extraBuyIn: 0, cashOut: 0 };
    });

    const pot = entries.reduce((s, e) => s + e.buyIns * 100, 0);
    // מחלקים את הקופה בפיזור פסאודו-אקראי אך דטרמיניסטי, ומאזנים בשארית
    const weights = entries.map((_, idx) => 0.4 + ((Math.sin((g + 1) * (idx + 2)) + 1) / 2) * 1.6);
    const weightSum = weights.reduce((s, w) => s + w, 0);
    let allocated = 0;
    entries.forEach((e, idx) => {
      const share = idx === entries.length - 1 ? pot - allocated : Math.round((pot * weights[idx]) / weightSum / 5) * 5;
      e.cashOut = round2(Math.max(0, share));
      allocated += e.cashOut;
    });
    const drift = round2(pot - entries.reduce((s, e) => s + e.cashOut, 0));
    entries[0].cashOut = round2(entries[0].cashOut + drift);

    games.push({
      id: newId(),
      date: iso,
      title: `ערב ${10 - g}`,
      location: ['אצל יהל', 'אצל דני', 'המועדון', 'אצל עומר'][g % 4],
      notes: '',
      buyInAmount: 100,
      entries,
      paidTransfers: [],
      createdAt: date.toISOString(),
    });
  }

  return {
    version: 1,
    players,
    games,
    settings: { groupName: 'שולחן חמישי', defaultBuyIn: 100 },
  };
}
