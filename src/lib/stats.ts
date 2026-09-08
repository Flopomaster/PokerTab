import type { Game, GameEntry, ID, Player } from '../types';
import { round2 } from './format';

export function entryBuyIn(entry: GameEntry, buyInAmount: number): number {
  return round2(entry.buyIns * buyInAmount + entry.extraBuyIn);
}

export interface PlayerResult {
  playerId: ID;
  buyIn: number;
  cashOut: number;
  net: number;
  rank: number;
}

export interface GameSummary {
  game: Game;
  results: PlayerResult[];
  totalBuyIn: number;
  totalCashOut: number;
  /** cashOut - buyIn. 0 = הקופה מאוזנת. */
  diff: number;
  balanced: boolean;
}

export function summarizeGame(game: Game): GameSummary {
  const results: PlayerResult[] = game.entries.map((e) => {
    const buyIn = entryBuyIn(e, game.buyInAmount);
    const cashOut = round2(e.cashOut);
    return { playerId: e.playerId, buyIn, cashOut, net: round2(cashOut - buyIn), rank: 0 };
  });

  results.sort((a, b) => b.net - a.net);
  let rank = 0;
  let prevNet = Number.NaN;
  results.forEach((r, idx) => {
    if (r.net !== prevNet) {
      rank = idx + 1;
      prevNet = r.net;
    }
    r.rank = rank;
  });

  const totalBuyIn = round2(results.reduce((s, r) => s + r.buyIn, 0));
  const totalCashOut = round2(results.reduce((s, r) => s + r.cashOut, 0));
  const diff = round2(totalCashOut - totalBuyIn);

  return { game, results, totalBuyIn, totalCashOut, diff, balanced: Math.abs(diff) < 0.005 };
}

/** ממיין ערבים כרונולוגית (הישן ראשון). */
export function sortGames(games: Game[]): Game[] {
  return [...games].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : 1;
  });
}

export interface PlayerStats {
  player: Player;
  games: number;
  totalBuyIn: number;
  totalCashOut: number;
  net: number;
  avgNet: number;
  roi: number;
  bestNight: number;
  worstNight: number;
  bestNightDate: string | null;
  worstNightDate: string | null;
  wins: number;
  podiums: number;
  lastPlaces: number;
  avgRank: number;
  profitableNights: number;
  itmRate: number;
  /** רצף נוכחי: חיובי = ניצחונות, שלילי = הפסדים */
  currentStreak: number;
  longestWinStreak: number;
  longestLoseStreak: number;
  /** סטיית תקן של תוצאות הערב — מדד תנודתיות */
  volatility: number;
  /** ההפרש הגדול ביותר בין ערב מפסיד לערב הבא אחריו */
  bestComeback: number;
  ranks: number[];
  nets: number[];
  cumulative: number[];
  lastPlayed: string | null;
}

export interface StatsBundle {
  summaries: GameSummary[];
  byPlayer: Map<ID, PlayerStats>;
  ordered: PlayerStats[];
  labels: string[];
}

const EMPTY_STATS = (player: Player): PlayerStats => ({
  player,
  games: 0,
  totalBuyIn: 0,
  totalCashOut: 0,
  net: 0,
  avgNet: 0,
  roi: 0,
  bestNight: 0,
  worstNight: 0,
  bestNightDate: null,
  worstNightDate: null,
  wins: 0,
  podiums: 0,
  lastPlaces: 0,
  avgRank: 0,
  profitableNights: 0,
  itmRate: 0,
  currentStreak: 0,
  longestWinStreak: 0,
  longestLoseStreak: 0,
  volatility: 0,
  bestComeback: 0,
  ranks: [],
  nets: [],
  cumulative: [],
  lastPlayed: null,
});

export function computeStats(games: Game[], players: Player[]): StatsBundle {
  // ערב שעדיין מתנהל אינו נספר: אין בו סכומי יציאה, וכל השחקנים
  // היו נראים בהפסד של גובה הכניסות עד לסגירתו
  const chronological = sortGames(games.filter((g) => g.status !== 'live'));
  const summaries = chronological.map(summarizeGame);
  const byPlayer = new Map<ID, PlayerStats>();
  players.forEach((p) => byPlayer.set(p.id, EMPTY_STATS(p)));

  for (const summary of summaries) {
    const lastRank = summary.results.length;
    for (const r of summary.results) {
      const stats = byPlayer.get(r.playerId);
      if (!stats) continue;
      stats.games += 1;
      stats.totalBuyIn = round2(stats.totalBuyIn + r.buyIn);
      stats.totalCashOut = round2(stats.totalCashOut + r.cashOut);
      stats.net = round2(stats.net + r.net);
      stats.nets.push(r.net);
      stats.cumulative.push(stats.net);
      stats.ranks.push(r.rank);
      stats.lastPlayed = summary.game.date;
      if (r.rank === 1) stats.wins += 1;
      if (r.rank <= 3) stats.podiums += 1;
      if (r.rank === lastRank && summary.results.length > 1) stats.lastPlaces += 1;
      if (r.net > 0) stats.profitableNights += 1;
      if (stats.games === 1 || r.net > stats.bestNight) {
        stats.bestNight = r.net;
        stats.bestNightDate = summary.game.date;
      }
      if (stats.games === 1 || r.net < stats.worstNight) {
        stats.worstNight = r.net;
        stats.worstNightDate = summary.game.date;
      }
    }
  }

  for (const stats of byPlayer.values()) {
    if (stats.games === 0) continue;
    stats.avgNet = round2(stats.net / stats.games);
    stats.roi = stats.totalBuyIn > 0 ? stats.net / stats.totalBuyIn : 0;
    stats.avgRank = round2(stats.ranks.reduce((s, r) => s + r, 0) / stats.games);
    stats.itmRate = stats.profitableNights / stats.games;

    const mean = stats.net / stats.games;
    const variance = stats.nets.reduce((s, n) => s + (n - mean) ** 2, 0) / stats.games;
    stats.volatility = round2(Math.sqrt(variance));

    let currentStreak = 0;
    for (let i = stats.nets.length - 1; i >= 0; i--) {
      const n = stats.nets[i];
      if (n === 0) break;
      if (currentStreak === 0) currentStreak = n > 0 ? 1 : -1;
      else if (n > 0 && currentStreak > 0) currentStreak += 1;
      else if (n < 0 && currentStreak < 0) currentStreak -= 1;
      else break;
    }
    stats.currentStreak = currentStreak;

    let win = 0;
    let lose = 0;
    for (const n of stats.nets) {
      if (n > 0) {
        win += 1;
        lose = 0;
      } else if (n < 0) {
        lose += 1;
        win = 0;
      } else {
        win = 0;
        lose = 0;
      }
      stats.longestWinStreak = Math.max(stats.longestWinStreak, win);
      stats.longestLoseStreak = Math.max(stats.longestLoseStreak, lose);
    }

    for (let i = 1; i < stats.nets.length; i++) {
      if (stats.nets[i - 1] < 0 && stats.nets[i] > 0) {
        stats.bestComeback = Math.max(stats.bestComeback, round2(stats.nets[i] - stats.nets[i - 1]));
      }
    }
  }

  const ordered = [...byPlayer.values()].sort((a, b) => {
    if (b.net !== a.net) return b.net - a.net;
    return b.games - a.games;
  });

  return {
    summaries,
    byPlayer,
    ordered,
    labels: summaries.map((s) => s.game.date),
  };
}

export interface HeadToHead {
  games: number;
  aWins: number;
  bWins: number;
  aNet: number;
  bNet: number;
}

export function headToHead(summaries: GameSummary[], a: ID, b: ID): HeadToHead {
  const out: HeadToHead = { games: 0, aWins: 0, bWins: 0, aNet: 0, bNet: 0 };
  for (const s of summaries) {
    const ra = s.results.find((r) => r.playerId === a);
    const rb = s.results.find((r) => r.playerId === b);
    if (!ra || !rb) continue;
    out.games += 1;
    out.aNet = round2(out.aNet + ra.net);
    out.bNet = round2(out.bNet + rb.net);
    if (ra.net > rb.net) out.aWins += 1;
    else if (rb.net > ra.net) out.bWins += 1;
  }
  return out;
}
