import type { Club, ClubData, Game, ID, Membership, MyMembership, Player, Profile, Role, SignUpInput, MemberStatus } from '../types';

export interface JoinResult {
  club: Club;
  status: MemberStatus;
}

/**
 * החוזה מול שכבת הנתונים. יש שני מימושים: Supabase (אמיתי, רב-משתמשים)
 * ומימוש מקומי לצורכי הדגמה כשאין הגדרות שרת.
 */
export interface Api {
  readonly kind: 'supabase' | 'demo';

  /* ---- חשבון ---- */
  currentProfile(): Promise<Profile | null>;
  onAuthChange(cb: () => void): () => void;
  signUp(input: SignUpInput): Promise<Profile>;
  signIn(usernameOrEmail: string, password: string): Promise<Profile>;
  signOut(): Promise<void>;
  updateProfile(patch: Partial<Pick<Profile, 'displayName' | 'emoji' | 'color'>>): Promise<Profile>;

  /* ---- קלאבים ---- */
  myMemberships(): Promise<MyMembership[]>;
  createClub(name: string, defaultBuyIn: number): Promise<Club>;
  joinClub(code: string): Promise<JoinResult>;
  leaveClub(clubId: ID): Promise<void>;
  updateClub(clubId: ID, patch: Partial<Pick<Club, 'name' | 'defaultBuyIn'>>): Promise<Club>;
  regenerateJoinCode(clubId: ID): Promise<string>;

  /* ---- חברי קלאב ---- */
  clubMembers(clubId: ID): Promise<Membership[]>;
  decideMember(clubId: ID, userId: ID, status: 'approved' | 'rejected'): Promise<void>;
  setMemberRole(clubId: ID, userId: ID, role: Role): Promise<void>;
  removeMember(clubId: ID, userId: ID): Promise<void>;

  /* ---- נתוני הקלאב ---- */
  loadClubData(clubId: ID): Promise<ClubData>;
  createPlayer(clubId: ID, input: { name: string; emoji: string; color: string; userId?: ID | null }): Promise<Player>;
  updatePlayer(playerId: ID, patch: Partial<Pick<Player, 'name' | 'emoji' | 'color' | 'archived' | 'userId'>>): Promise<void>;
  deletePlayer(playerId: ID): Promise<void>;
  saveGame(game: Omit<Game, 'createdAt'> & { createdAt?: string }, isNew: boolean): Promise<Game>;
  deleteGame(gameId: ID): Promise<void>;
  setPaidTransfers(gameId: ID, keys: string[]): Promise<void>;

  /** מנוי לשינויים בקלאב; מחזיר פונקציית ביטול */
  subscribe(clubId: ID, onChange: () => void): () => void;
}

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/** תרגום שגיאות לעברית ברורה למשתמש */
export function errorMessage(e: unknown): string {
  const code = e instanceof ApiError ? e.code : '';
  const raw = e instanceof Error ? e.message : String(e);
  switch (code) {
    case 'CLUB_NOT_FOUND':
      return 'לא נמצא קלאב עם הקוד הזה. בדקו את הקוד עם האדמין.';
    case 'USERNAME_TAKEN':
      return 'שם המשתמש הזה כבר תפוס. נסו אחר.';
    case 'BAD_CREDENTIALS':
      return 'שם משתמש או סיסמה שגויים.';
    case 'NOT_ADMIN':
      return 'רק אדמין הקלאב יכול לעשות את זה.';
    case 'NOT_AUTHENTICATED':
      return 'צריך להתחבר קודם.';
    default:
      if (/Invalid login credentials/i.test(raw)) return 'שם משתמש או סיסמה שגויים.';
      if (/already registered|User already/i.test(raw)) return 'שם המשתמש הזה כבר תפוס. נסו אחר.';
      if (/Password should be/i.test(raw)) return 'הסיסמה קצרה מדי — לפחות 6 תווים.';
      return raw || 'משהו השתבש. נסו שוב.';
  }
}
