export type ID = string;

export interface Player {
  id: ID;
  name: string;
  emoji: string;
  color: string;
  createdAt: string;
  archived?: boolean;
}

/** שורת שחקן בערב בודד. כל הסכומים בכסף (₪). */
export interface GameEntry {
  playerId: ID;
  /** מספר כניסות (buy-ins) בסכום הסטנדרטי של הערב */
  buyIns: number;
  /** תוספת חופשית מעבר לכניסות המלאות (ריביי חלקי וכו') */
  extraBuyIn: number;
  /** כמה יצא איתו בסוף הערב */
  cashOut: number;
}

export interface Game {
  id: ID;
  date: string;
  title: string;
  location: string;
  notes: string;
  /** סכום כניסה סטנדרטי לערב הזה */
  buyInAmount: number;
  entries: GameEntry[];
  /** מפתחות העברות שסומנו כשולמו: `${fromId}>${toId}` */
  paidTransfers: string[];
  createdAt: string;
}

export interface Settings {
  groupName: string;
  defaultBuyIn: number;
}

export interface AppData {
  version: number;
  players: Player[];
  games: Game[];
  settings: Settings;
}

export interface Transfer {
  from: ID;
  to: ID;
  amount: number;
}
