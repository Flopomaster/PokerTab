import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Api, JoinResult } from './api';
import { ApiError } from './api';
import type { Club, ClubData, Game, Membership, MyMembership, Player, Profile, Role, SignUpInput } from '../types';

/** דומיין פנימי לחשבונות שנרשמו בלי מייל אמיתי */
const INTERNAL_DOMAIN = 'pokertab.app';

const syntheticEmail = (username: string) => `${username.trim().toLowerCase()}@${INTERNAL_DOMAIN}`;

interface ClubRow {
  id: string;
  name: string;
  join_code: string;
  default_buy_in: number | string;
  created_by: string | null;
  created_at: string;
}

interface PlayerRow {
  id: string;
  club_id: string;
  name: string;
  emoji: string;
  color: string;
  user_id: string | null;
  archived: boolean;
  created_at: string;
}

interface EntryRow {
  player_id: string;
  buy_ins: number | string;
  extra_buy_in: number | string;
  cash_out: number | string;
}

interface GameRow {
  id: string;
  club_id: string;
  date: string;
  title: string;
  location: string;
  notes: string;
  buy_in_amount: number | string;
  dealer_id: string | null;
  status?: string | null;
  paid_transfers: string[] | null;
  created_at: string;
  game_entries?: EntryRow[];
}

interface ProfileRow {
  id: string;
  username: string;
  display_name: string;
  emoji: string;
  color: string;
}

const num = (v: number | string) => (typeof v === 'number' ? v : Number(v) || 0);

const toClub = (r: ClubRow): Club => ({
  id: r.id,
  name: r.name,
  joinCode: r.join_code,
  defaultBuyIn: num(r.default_buy_in),
  createdBy: r.created_by,
  createdAt: r.created_at,
});

const toProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  username: r.username,
  displayName: r.display_name,
  emoji: r.emoji,
  color: r.color,
});

const toPlayer = (r: PlayerRow): Player => ({
  id: r.id,
  clubId: r.club_id,
  name: r.name,
  emoji: r.emoji,
  color: r.color,
  userId: r.user_id,
  archived: r.archived,
  createdAt: r.created_at,
});

const toGame = (r: GameRow): Game => ({
  id: r.id,
  clubId: r.club_id,
  date: r.date,
  title: r.title ?? '',
  location: r.location ?? '',
  notes: r.notes ?? '',
  buyInAmount: num(r.buy_in_amount),
  dealerId: r.dealer_id,
  status: r.status === 'live' ? 'live' : 'closed',
  paidTransfers: r.paid_transfers ?? [],
  createdAt: r.created_at,
  entries: (r.game_entries ?? []).map((e) => ({
    playerId: e.player_id,
    buyIns: num(e.buy_ins),
    extraBuyIn: num(e.extra_buy_in),
    cashOut: num(e.cash_out),
  })),
});

function fail(error: { message: string } | null): void {
  if (error) throw new ApiError('', error.message);
}

export function createSupabaseApi(url: string, anonKey: string): Api {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  /** מוודא שקיימת שורת פרופיל למשתמש המחובר (למשל אם ההרשמה נקטעה) */
  async function ensureProfile(): Promise<Profile | null> {
    const { data: userData } = await sb.auth.getUser();
    const user = userData.user;
    if (!user) return null;

    const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) throw new ApiError('', error.message);
    if (data) return toProfile(data as ProfileRow);

    const meta = (user.user_metadata ?? {}) as { username?: string; display_name?: string };
    const username = meta.username ?? user.email?.split('@')[0] ?? 'player';
    const row = {
      id: user.id,
      username,
      display_name: meta.display_name ?? username,
      emoji: '🃏',
      color: '#f0b429',
    };
    const { data: created, error: insertError } = await sb.from('profiles').insert(row).select().single();
    if (insertError) throw new ApiError('', insertError.message);
    return toProfile(created as ProfileRow);
  }

  async function myId(): Promise<string> {
    const { data } = await sb.auth.getUser();
    if (!data.user) throw new ApiError('NOT_AUTHENTICATED', 'not authenticated');
    return data.user.id;
  }

  return {
    kind: 'supabase',

    async currentProfile() {
      const { data } = await sb.auth.getSession();
      if (!data.session) return null;
      return ensureProfile();
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange(() => cb());
      return () => data.subscription.unsubscribe();
    },

    async signUp({ username, password, displayName, email }: SignUpInput) {
      const clean = username.trim();
      const { data: available, error: availabilityError } = await sb.rpc('username_available', { p_username: clean });
      if (availabilityError) throw new ApiError('', availabilityError.message);
      if (available === false) throw new ApiError('USERNAME_TAKEN', 'username taken');

      const { error } = await sb.auth.signUp({
        email: email?.trim() || syntheticEmail(clean),
        password,
        options: { data: { username: clean, display_name: displayName.trim() || clean } },
      });
      if (error) throw new ApiError('', error.message);

      const profile = await ensureProfile();
      if (!profile) throw new ApiError('', 'ההרשמה הצליחה אך ההתחברות נכשלה. נסו להתחבר.');
      return profile;
    },

    async signIn(usernameOrEmail, password) {
      const input = usernameOrEmail.trim();
      let email = input;
      if (!input.includes('@')) {
        const { data, error } = await sb.rpc('login_email', { p_username: input });
        if (error) throw new ApiError('', error.message);
        if (!data) throw new ApiError('BAD_CREDENTIALS', 'bad credentials');
        email = data as string;
      }
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new ApiError('BAD_CREDENTIALS', error.message);
      const profile = await ensureProfile();
      if (!profile) throw new ApiError('BAD_CREDENTIALS', 'bad credentials');
      return profile;
    },

    async signOut() {
      await sb.auth.signOut();
    },

    async updateProfile(patch) {
      const id = await myId();
      const row: Record<string, unknown> = {};
      if (patch.displayName !== undefined) row.display_name = patch.displayName;
      if (patch.emoji !== undefined) row.emoji = patch.emoji;
      if (patch.color !== undefined) row.color = patch.color;
      const { data, error } = await sb.from('profiles').update(row).eq('id', id).select().single();
      fail(error);

      // מסנכרנים את השם והמראה גם לשורות השחקן המקושרות בכל קלאב
      const playerPatch: Record<string, unknown> = {};
      if (patch.displayName !== undefined) playerPatch.name = patch.displayName;
      if (patch.emoji !== undefined) playerPatch.emoji = patch.emoji;
      if (patch.color !== undefined) playerPatch.color = patch.color;
      if (Object.keys(playerPatch).length > 0) {
        await sb.from('players').update(playerPatch).eq('user_id', id);
      }

      return toProfile(data as ProfileRow);
    },

    async myMemberships() {
      const id = await myId();
      const { data, error } = await sb
        .from('club_members')
        .select('club_id, user_id, role, status, requested_at, clubs(*)')
        .eq('user_id', id);
      fail(error);
      return ((data ?? []) as unknown as (Membership & { club_id: string; user_id: string; requested_at: string; clubs: ClubRow })[])
        .filter((r) => !!r.clubs)
        .map<MyMembership>((r) => ({
          clubId: r.club_id,
          userId: r.user_id,
          role: r.role,
          status: r.status,
          requestedAt: r.requested_at,
          club: toClub(r.clubs),
        }));
    },

    async createClub(name, defaultBuyIn) {
      const { data, error } = await sb.rpc('create_club', { p_name: name, p_buy_in: defaultBuyIn });
      fail(error);
      const row = Array.isArray(data) ? data[0] : data;
      return toClub(row as ClubRow);
    },

    async joinClub(code): Promise<JoinResult> {
      const { data, error } = await sb.rpc('join_club', { p_code: code });
      if (error) {
        if (/CLUB_NOT_FOUND/.test(error.message)) throw new ApiError('CLUB_NOT_FOUND', error.message);
        throw new ApiError('', error.message);
      }
      const row = (Array.isArray(data) ? data[0] : data) as { club_id: string; status: Membership['status'] };
      const { data: clubRow, error: clubError } = await sb.from('clubs').select('*').eq('id', row.club_id).single();
      fail(clubError);
      return { club: toClub(clubRow as ClubRow), status: row.status };
    },

    async leaveClub(clubId) {
      const id = await myId();
      const { error } = await sb.from('club_members').delete().eq('club_id', clubId).eq('user_id', id);
      fail(error);
    },

    async updateClub(clubId, patch) {
      const row: Record<string, unknown> = {};
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.defaultBuyIn !== undefined) row.default_buy_in = patch.defaultBuyIn;
      const { data, error } = await sb.from('clubs').update(row).eq('id', clubId).select().single();
      fail(error);
      return toClub(data as ClubRow);
    },

    async regenerateJoinCode(clubId) {
      const { data, error } = await sb.rpc('regenerate_join_code', { p_club: clubId });
      if (error) {
        if (/NOT_ADMIN/.test(error.message)) throw new ApiError('NOT_ADMIN', error.message);
        throw new ApiError('', error.message);
      }
      return data as string;
    },

    async clubMembers(clubId) {
      const { data, error } = await sb
        .from('club_members')
        // חובה לציין את שם המפתח הזר: ל-club_members יש שתי הפניות
        // ל-profiles (user_id ו-decided_by), וצירוף לא מפורש נכשל
        .select('club_id, user_id, role, status, requested_at, profiles!club_members_user_id_fkey(*)')
        .eq('club_id', clubId);
      fail(error);
      return ((data ?? []) as unknown as (Membership & { club_id: string; user_id: string; requested_at: string; profiles: ProfileRow | ProfileRow[] | null })[]).map<Membership>((r) => ({
        clubId: r.club_id,
        userId: r.user_id,
        role: r.role,
        status: r.status,
        requestedAt: r.requested_at,
        profile: r.profiles ? toProfile(Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) : undefined,
      }));
    },

    async decideMember(clubId, userId, status) {
      const me = await myId();
      const { error } = await sb
        .from('club_members')
        .update({ status, decided_at: new Date().toISOString(), decided_by: me })
        .eq('club_id', clubId)
        .eq('user_id', userId);
      fail(error);

      if (status === 'approved') {
        const { data: existing } = await sb
          .from('players')
          .select('id')
          .eq('club_id', clubId)
          .eq('user_id', userId)
          .maybeSingle();
        if (!existing) {
          const { data: profile } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
          if (profile) {
            const p = profile as ProfileRow;
            await sb.from('players').insert({
              club_id: clubId,
              name: p.display_name,
              emoji: p.emoji,
              color: p.color,
              user_id: p.id,
            });
          }
        }
      }
    },

    async setMemberRole(clubId, userId, role: Role) {
      const { error } = await sb.from('club_members').update({ role }).eq('club_id', clubId).eq('user_id', userId);
      fail(error);
    },

    async removeMember(clubId, userId) {
      const { error } = await sb.from('club_members').delete().eq('club_id', clubId).eq('user_id', userId);
      fail(error);
    },

    async loadClubData(clubId): Promise<ClubData> {
      const [playersRes, gamesRes] = await Promise.all([
        sb.from('players').select('*').eq('club_id', clubId).order('created_at'),
        sb.from('games').select('*, game_entries(*)').eq('club_id', clubId).order('date'),
      ]);
      fail(playersRes.error);
      fail(gamesRes.error);
      return {
        players: ((playersRes.data ?? []) as PlayerRow[]).map(toPlayer),
        games: ((gamesRes.data ?? []) as GameRow[]).map(toGame),
      };
    },

    async createPlayer(clubId, input) {
      const { data, error } = await sb
        .from('players')
        .insert({
          club_id: clubId,
          name: input.name,
          emoji: input.emoji,
          color: input.color,
          user_id: input.userId ?? null,
        })
        .select()
        .single();
      fail(error);
      return toPlayer(data as PlayerRow);
    },

    async updatePlayer(playerId, patch) {
      const row: Record<string, unknown> = {};
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.emoji !== undefined) row.emoji = patch.emoji;
      if (patch.color !== undefined) row.color = patch.color;
      if (patch.archived !== undefined) row.archived = patch.archived;
      if (patch.userId !== undefined) row.user_id = patch.userId;
      const { error } = await sb.from('players').update(row).eq('id', playerId);
      fail(error);
    },

    async deletePlayer(playerId) {
      const { error } = await sb.from('players').delete().eq('id', playerId);
      fail(error);
    },

    async saveGame(game, isNew) {
      const row = {
        id: game.id,
        club_id: game.clubId,
        date: game.date,
        title: game.title,
        location: game.location,
        notes: game.notes,
        buy_in_amount: game.buyInAmount,
        dealer_id: game.dealerId,
        status: game.status,
        paid_transfers: game.paidTransfers,
      };
      // חשוב: לא upsert. upsert על שורה קיימת נבדק גם מול מדיניות ה-INSERT,
      // שדורשת שהכותב יהיה הדילר — וכך אדמין לא היה יכול לערוך ערב של אחר.
      const { data, error } = isNew
        ? await sb.from('games').insert(row).select().single()
        : await sb.from('games').update(row).eq('id', game.id).select().single();
      fail(error);

      // מוחקים שורות שכבר לא קיימות ואז כותבים את הנוכחיות
      const keep = game.entries.map((e) => e.playerId);
      let del = sb.from('game_entries').delete().eq('game_id', game.id);
      if (keep.length > 0) del = del.not('player_id', 'in', `(${keep.join(',')})`);
      const { error: deleteError } = await del;
      fail(deleteError);

      if (game.entries.length > 0) {
        const { error: entriesError } = await sb.from('game_entries').upsert(
          game.entries.map((e) => ({
            game_id: game.id,
            player_id: e.playerId,
            buy_ins: e.buyIns,
            extra_buy_in: e.extraBuyIn,
            cash_out: e.cashOut,
          })),
        );
        fail(entriesError);
      }

      return { ...toGame(data as GameRow), entries: game.entries };
    },

    async deleteGame(gameId) {
      const { error } = await sb.from('games').delete().eq('id', gameId);
      fail(error);
    },

    async setPaidTransfers(gameId, keys) {
      const { error } = await sb.from('games').update({ paid_transfers: keys }).eq('id', gameId);
      fail(error);
    },

    subscribe(clubId, onChange) {
      const channel = sb
        .channel(`club-${clubId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `club_id=eq.${clubId}` }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `club_id=eq.${clubId}` }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'club_members', filter: `club_id=eq.${clubId}` }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'game_entries' }, onChange)
        .subscribe();
      return () => {
        void sb.removeChannel(channel);
      };
    },
  };
}
