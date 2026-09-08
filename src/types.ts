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

export interface Game {
  id: ID;
  clubId: ID;
  date: string;
  title: string;
  location: string;
  notes: string;
  buyInAmount: number;
  /** "הדילר" — האחראי על הערב, היחיד שיכול לערוך אותו מלבד אדמין הקלאב */
  dealerId: ID | null;
  entries: GameEntry[];
  paidTransfers: string[];
  createdAt: string;
}

export interface ClubData {
  players: Player[];
  games: Game[];
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
