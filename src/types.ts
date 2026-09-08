export type ID = string;

export type Role = 'admin' | 'member';
export type MemberStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: ID;
  username: string;
  displayName: string;
  emoji: string;
  color: string;
}

export interface Club {
  id: ID;
  name: string;
  joinCode: string;
  defaultBuyIn: number;
  createdBy: ID | null;
  createdAt: string;
}

export interface Membership {
  clubId: ID;
  userId: ID;
  role: Role;
  status: MemberStatus;
  requestedAt: string;
  profile?: Profile;
}

export interface MyMembership extends Membership {
  club: Club;
}

/** שחקן בקלאב. userId ריק = שחקן אורח בלי חשבון. */
export interface Player {
  id: ID;
  clubId: ID;
  name: string;
  emoji: string;
  color: string;
  userId: ID | null;
  archived: boolean;
  createdAt: string;
}

export interface GameEntry {
  playerId: ID;
  buyIns: number;
  extraBuyIn: number;
  cashOut: number;
}

export type GameStatus = 'live' | 'closed';

export interface Game {
  id: ID;
  clubId: ID;
  /** live = השולחן מתנהל עכשיו; closed = נסגר וחושבו ההעברות */
  status: GameStatus;
  date: string;
  title: string;
  location: string;
  notes: string;
  buyInAmount: number;
  /** "הדילר" — האחראי על השולחן, היחיד שיכול לערוך אותו מלבד אדמין הקלאב */
  dealerId: ID | null;
  entries: GameEntry[];
  paidTransfers: string[];
  createdAt: string;
}

/** מצב ההעברה: המשלם מסמן שהעביר, המקבל מאשר שקיבל. */
export interface Settlement {
  gameId: ID;
  fromPlayer: ID;
  toPlayer: ID;
  senderMarked: boolean;
  receiverConfirmed: boolean;
}

export interface ClubData {
  players: Player[];
  games: Game[];
  settlements: Settlement[];
}

/** חוב פתוח של שחקן משולחן קודם שטרם אושר על ידי המקבל. */
export interface OpenDebt {
  gameId: ID;
  date: string;
  toPlayerId: ID;
  amount: number;
  senderMarked: boolean;
}

export interface Transfer {
  from: ID;
  to: ID;
  amount: number;
}

export interface SignUpInput {
  username: string;
  password: string;
  displayName: string;
  email?: string;
}
