import type { ID, Transfer } from '../types';
import { round2 } from './format';

export interface NetBalance {
  id: ID;
  net: number;
}

/**
 * מחשב את מספר ההעברות המינימלי (בקירוב אופטימלי) לסגירת החובות.
 * שלב 1: מזווגים חובות שמתקזזים בדיוק — כל זוג כזה חוסך העברה.
 * שלב 2: greedy — החייב הגדול ביותר מעביר לזוכה הגדול ביותר.
 * העבודה מתבצעת באגורות (מספרים שלמים) כדי להימנע משגיאות float.
 */
export function computeTransfers(balances: NetBalance[]): Transfer[] {
  const toCents = (n: number) => Math.round(n * 100);

  const debtors = balances
    .filter((b) => toCents(b.net) < 0)
    .map((b) => ({ id: b.id, amount: -toCents(b.net) }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = balances
    .filter((b) => toCents(b.net) > 0)
    .map((b) => ({ id: b.id, amount: toCents(b.net) }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];

  // שלב 1 — התאמות מדויקות
  for (const d of debtors) {
    if (d.amount === 0) continue;
    const match = creditors.find((c) => c.amount === d.amount);
    if (match) {
      transfers.push({ from: d.id, to: match.id, amount: round2(d.amount / 100) });
      d.amount = 0;
      match.amount = 0;
    }
  }

  // שלב 2 — greedy על מה שנשאר
  const openDebtors = debtors.filter((d) => d.amount > 0).sort((a, b) => b.amount - a.amount);
  const openCreditors = creditors.filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);

  let i = 0;
  let j = 0;
  while (i < openDebtors.length && j < openCreditors.length) {
    const d = openDebtors[i];
    const c = openCreditors[j];
    const amount = Math.min(d.amount, c.amount);
    if (amount > 0) {
      transfers.push({ from: d.id, to: c.id, amount: round2(amount / 100) });
      d.amount -= amount;
      c.amount -= amount;
    }
    if (d.amount === 0) i++;
    if (c.amount === 0) j++;
  }

  return transfers.sort((a, b) => b.amount - a.amount);
}

export function transferKey(t: Transfer): string {
  return `${t.from}>${t.to}`;
}
