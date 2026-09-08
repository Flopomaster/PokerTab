import type { PlayerStats } from './stats';
import { money, signedMoney } from './format';

export interface Title {
  key: string;
  emoji: string;
  name: string;
  description: string;
  /** הטקסט שמופיע מתחת לשם הזוכה */
  detail: string;
  winnerId: string;
  tone: 'gold' | 'green' | 'red' | 'blue' | 'purple';
}

type Candidate = {
  key: string;
  emoji: string;
  name: string;
  description: string;
  tone: Title['tone'];
  minGames: number;
  /** ציון גבוה יותר = מנצח. null = לא מועמד. */
  score: (s: PlayerStats) => number | null;
  detail: (s: PlayerStats) => string;
};

const CANDIDATES: Candidate[] = [
  {
    key: 'king',
    emoji: '👑',
    name: 'המלך',
    description: 'המאזן הכולל הגבוה ביותר בקבוצה',
    tone: 'gold',
    minGames: 1,
    score: (s) => (s.net > 0 ? s.net : null),
    detail: (s) => `${signedMoney(s.net)} ב-${s.games} ערבים`,
  },
  {
    key: 'atm',
    emoji: '🏧',
    name: 'הבנקומט',
    description: 'תרם לקופה יותר מכולם',
    tone: 'red',
    minGames: 1,
    score: (s) => (s.net < 0 ? -s.net : null),
    detail: (s) => `${signedMoney(s.net)} ב-${s.games} ערבים`,
  },
  {
    key: 'machine',
    emoji: '🤖',
    name: 'המכונה',
    description: 'ה-ROI הגבוה ביותר (מינימום 3 ערבים)',
    tone: 'green',
    minGames: 3,
    score: (s) => (s.roi > 0 ? s.roi : null),
    detail: (s) => `${(s.roi * 100).toFixed(1)}% תשואה על הכניסות`,
  },
  {
    key: 'hot',
    emoji: '🔥',
    name: 'הלוהט',
    description: 'רצף הניצחונות הפעיל הארוך ביותר',
    tone: 'gold',
    minGames: 2,
    score: (s) => (s.currentStreak >= 2 ? s.currentStreak : null),
    detail: (s) => `${s.currentStreak} ערבים ברווח ברצף`,
  },
  {
    key: 'ice',
    emoji: '🧊',
    name: 'הקפוא',
    description: 'רצף ההפסדים הפעיל הארוך ביותר',
    tone: 'blue',
    minGames: 2,
    score: (s) => (s.currentStreak <= -2 ? -s.currentStreak : null),
    detail: (s) => `${-s.currentStreak} ערבים בהפסד ברצף`,
  },
  {
    key: 'nightOfLife',
    emoji: '💥',
    name: 'הערב של החיים',
    description: 'הערב הרווחי ביותר שנרשם אי פעם',
    tone: 'gold',
    minGames: 1,
    score: (s) => (s.bestNight > 0 ? s.bestNight : null),
    detail: (s) => `${signedMoney(s.bestNight)} בערב אחד`,
  },
  {
    key: 'pit',
    emoji: '🕳️',
    name: 'הבור',
    description: 'ההפסד הגדול ביותר בערב בודד',
    tone: 'red',
    minGames: 1,
    score: (s) => (s.worstNight < 0 ? -s.worstNight : null),
    detail: (s) => `${signedMoney(s.worstNight)} בערב אחד`,
  },
  {
    key: 'comeback',
    emoji: '🔄',
    name: 'הקומבקיסט',
    description: 'הקפיצה הגדולה ביותר מערב מפסיד לערב מנצח',
    tone: 'purple',
    minGames: 2,
    score: (s) => (s.bestComeback > 0 ? s.bestComeback : null),
    detail: (s) => `שיפור של ${money(s.bestComeback)} בין ערבים`,
  },
  {
    key: 'rock',
    emoji: '🎯',
    name: 'הסלע',
    description: 'התוצאות הכי יציבות — תנודתיות מינימלית (מ-3 ערבים)',
    tone: 'blue',
    minGames: 3,
    score: (s) => (s.volatility > 0 ? -s.volatility : null),
    detail: (s) => `סטיית תקן ${money(s.volatility)} לערב`,
  },
  {
    key: 'sheriff',
    emoji: '🤠',
    name: 'השריף',
    description: 'הכי הרבה ניצחונות ערב (מקום ראשון)',
    tone: 'gold',
    minGames: 1,
    score: (s) => (s.wins > 0 ? s.wins : null),
    detail: (s) => `${s.wins} ניצחונות ערב`,
  },
  {
    key: 'ironman',
    emoji: '🧲',
    name: 'המתמיד',
    description: 'לא מפספס ערב — הכי הרבה הופעות',
    tone: 'purple',
    minGames: 2,
    score: (s) => s.games,
    detail: (s) => `${s.games} ערבים על השולחן`,
  },
  {
    key: 'closer',
    emoji: '🧠',
    name: 'הקריאה הנכונה',
    description: 'אחוז הערבים ברווח הגבוה ביותר (מ-3 ערבים)',
    tone: 'green',
    minGames: 3,
    score: (s) => (s.itmRate > 0 ? s.itmRate : null),
    detail: (s) => `${Math.round(s.itmRate * 100)}% מהערבים ברווח`,
  },
];

export function computeTitles(all: PlayerStats[]): Title[] {
  const titles: Title[] = [];
  for (const c of CANDIDATES) {
    let best: { stats: PlayerStats; score: number } | null = null;
    for (const s of all) {
      if (s.games < c.minGames) continue;
      const score = c.score(s);
      if (score === null) continue;
      if (!best || score > best.score || (score === best.score && s.games > best.stats.games)) {
        best = { stats: s, score };
      }
    }
    if (!best) continue;
    titles.push({
      key: c.key,
      emoji: c.emoji,
      name: c.name,
      description: c.description,
      detail: c.detail(best.stats),
      winnerId: best.stats.player.id,
      tone: c.tone,
    });
  }
  return titles;
}
