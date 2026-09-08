import type { Api, JoinResult } from './api';
import { ApiError } from './api';
import type { Club, ClubData, Game, ID, Membership, MyMembership, Player, Profile, Role, SignUpInput } from '../types';

/**
 * מימוש מקומי לצורכי הדגמה בלבד — כל ה"משתמשים" חיים באותו דפדפן.
 * נועד לאפשר להתנסות בזרימת הקלאבים לפני חיבור Supabase, ואינו
 * מאובטח: אין כאן שרת, והסיסמאות נשמרות כטקסט בדפדפן המקומי.
 */

const KEY = 'pokertab.demo.v1';

interface DemoUser extends Profile {
  password: string;
  email?: string;
}

interface DemoState {
  users: DemoUser[];
  sessionUserId: ID | null;
  clubs: Club[];
  members: Membership[];
  players: Player[];
  games: Game[];
}

const empty = (): DemoState => ({ users: [], sessionUserId: null, clubs: [], members: [], players: [], games: [] });

function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    return { ...empty(), ...JSON.parse(raw) };
  } catch {
    return empty();
  }
}

function save(state: DemoState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* אחסון מלא — לא מפילים את האפליקציה */
  }
}

function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode(state: DemoState): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    if (!state.clubs.some((c) => c.joinCode === code)) return code;
  }
}

const toProfile = (u: DemoUser): Profile => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  emoji: u.emoji,
  color: u.color,
});

export function createDemoApi(): Api {
  let state = load();
  const listeners = new Set<() => void>();
  const dataListeners = new Set<() => void>();

  const persist = () => {
    save(state);
    dataListeners.forEach((cb) => cb());
  };

  const me = (): DemoUser => {
    const u = state.users.find((x) => x.id === state.sessionUserId);
    if (!u) throw new ApiError('NOT_AUTHENTICATED', 'not authenticated');
    return u;
  };

  const requireAdmin = (clubId: ID) => {
    const m = state.members.find((x) => x.clubId === clubId && x.userId === me().id);
    if (!m || m.role !== 'admin' || m.status !== 'approved') throw new ApiError('NOT_ADMIN', 'not admin');
  };

  return {
    kind: 'demo',

    async currentProfile() {
      state = load();
      const u = state.users.find((x) => x.id === state.sessionUserId);
      return u ? toProfile(u) : null;
    },

    onAuthChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    async signUp({ username, password, displayName, email }: SignUpInput) {
      const clean = username.trim().toLowerCase();
      if (state.users.some((u) => u.username.toLowerCase() === clean)) {
        throw new ApiError('USERNAME_TAKEN', 'username taken');
      }
      if (password.length < 6) throw new ApiError('WEAK_PASSWORD', 'Password should be at least 6 characters');
      const user: DemoUser = {
        id: uid(),
        username: username.trim(),
        displayName: displayName.trim() || username.trim(),
        emoji: '🃏',
        color: '#f0b429',
        password,
        email: email?.trim() || undefined,
      };
      state.users.push(user);
      state.sessionUserId = user.id;
      persist();
      listeners.forEach((cb) => cb());
      return toProfile(user);
    },

    async signIn(usernameOrEmail, password) {
      state = load();
      const key = usernameOrEmail.trim().toLowerCase();
      const user = state.users.find(
        (u) => u.username.toLowerCase() === key || (u.email ?? '').toLowerCase() === key,
      );
      if (!user || user.password !== password) throw new ApiError('BAD_CREDENTIALS', 'bad credentials');
      state.sessionUserId = user.id;
      persist();
      listeners.forEach((cb) => cb());
      return toProfile(user);
    },

    async signOut() {
      state.sessionUserId = null;
      persist();
      listeners.forEach((cb) => cb());
    },

    async updateProfile(patch) {
      const u = me();
      Object.assign(u, patch);
      // מסנכרנים גם את השחקן המקושר בכל קלאב
      state.players.forEach((p) => {
        if (p.userId === u.id) {
          if (patch.displayName) p.name = patch.displayName;
          if (patch.emoji) p.emoji = patch.emoji;
          if (patch.color) p.color = patch.color;
        }
      });
      persist();
      listeners.forEach((cb) => cb());
      return toProfile(u);
    },

    async myMemberships() {
      state = load();
      const uid0 = state.sessionUserId;
      if (!uid0) return [];
      return state.members
        .filter((m) => m.userId === uid0)
        .map((m) => ({ ...m, club: state.clubs.find((c) => c.id === m.clubId)! }))
        .filter((m): m is MyMembership => !!m.club);
    },

    async createClub(name, defaultBuyIn) {
      const u = me();
      const club: Club = {
        id: uid(),
        name: name.trim(),
        joinCode: makeCode(state),
        defaultBuyIn,
        createdBy: u.id,
        createdAt: new Date().toISOString(),
      };
      state.clubs.push(club);
      state.members.push({
        clubId: club.id,
        userId: u.id,
        role: 'admin',
        status: 'approved',
        requestedAt: new Date().toISOString(),
      });
      state.players.push({
        id: uid(),
        clubId: club.id,
        name: u.displayName,
        emoji: u.emoji,
        color: u.color,
        userId: u.id,
        archived: false,
        createdAt: new Date().toISOString(),
      });
      persist();
      return club;
    },

    async joinClub(code): Promise<JoinResult> {
      const u = me();
      const club = state.clubs.find((c) => c.joinCode.toUpperCase() === code.trim().toUpperCase());
      if (!club) throw new ApiError('CLUB_NOT_FOUND', 'club not found');
      const existing = state.members.find((m) => m.clubId === club.id && m.userId === u.id);
      if (existing) {
        if (existing.status === 'rejected') {
          existing.status = 'pending';
          existing.requestedAt = new Date().toISOString();
          persist();
        }
        return { club, status: existing.status };
      }
      state.members.push({
        clubId: club.id,
        userId: u.id,
        role: 'member',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      });
      persist();
      return { club, status: 'pending' };
    },

    async leaveClub(clubId) {
      const u = me();
      state.members = state.members.filter((m) => !(m.clubId === clubId && m.userId === u.id));
      persist();
    },

    async updateClub(clubId, patch) {
      requireAdmin(clubId);
      const club = state.clubs.find((c) => c.id === clubId)!;
      Object.assign(club, patch);
      persist();
      return club;
    },

    async regenerateJoinCode(clubId) {
      requireAdmin(clubId);
      const club = state.clubs.find((c) => c.id === clubId)!;
      club.joinCode = makeCode(state);
      persist();
      return club.joinCode;
    },

    async clubMembers(clubId) {
      state = load();
      return state.members
        .filter((m) => m.clubId === clubId)
        .map((m) => {
          const u = state.users.find((x) => x.id === m.userId);
          return { ...m, profile: u ? toProfile(u) : undefined };
        });
    },

    async decideMember(clubId, userId, status) {
      requireAdmin(clubId);
      const m = state.members.find((x) => x.clubId === clubId && x.userId === userId);
      if (!m) return;
      m.status = status;
      if (status === 'approved' && !state.players.some((p) => p.clubId === clubId && p.userId === userId)) {
        const u = state.users.find((x) => x.id === userId);
        if (u) {
          state.players.push({
            id: uid(),
            clubId,
            name: u.displayName,
            emoji: u.emoji,
            color: u.color,
            userId: u.id,
            archived: false,
            createdAt: new Date().toISOString(),
          });
        }
      }
      persist();
    },

    async setMemberRole(clubId, userId, role: Role) {
      requireAdmin(clubId);
      const m = state.members.find((x) => x.clubId === clubId && x.userId === userId);
      if (m) m.role = role;
      persist();
    },

    async removeMember(clubId, userId) {
      requireAdmin(clubId);
      state.members = state.members.filter((m) => !(m.clubId === clubId && m.userId === userId));
      state.players.forEach((p) => {
        if (p.clubId === clubId && p.userId === userId) p.userId = null;
      });
      persist();
    },

    async loadClubData(clubId): Promise<ClubData> {
      state = load();
      return {
        players: state.players.filter((p) => p.clubId === clubId),
        games: state.games.filter((g) => g.clubId === clubId),
      };
    },

    async createPlayer(clubId, input) {
      const player: Player = {
        id: uid(),
        clubId,
        name: input.name.trim(),
        emoji: input.emoji,
        color: input.color,
        userId: input.userId ?? null,
        archived: false,
        createdAt: new Date().toISOString(),
      };
      state.players.push(player);
      persist();
      return player;
    },

    async updatePlayer(playerId, patch) {
      const p = state.players.find((x) => x.id === playerId);
      if (p) Object.assign(p, patch);
      persist();
    },

    async deletePlayer(playerId) {
      state.players = state.players.filter((p) => p.id !== playerId);
      state.games.forEach((g) => {
        g.entries = g.entries.filter((e) => e.playerId !== playerId);
      });
      persist();
    },

    async saveGame(game, _isNew) {
      const full: Game = { ...game, createdAt: game.createdAt ?? new Date().toISOString() };
      const idx = state.games.findIndex((g) => g.id === full.id);
      if (idx >= 0) state.games[idx] = full;
      else state.games.push(full);
      persist();
      return full;
    },

    async deleteGame(gameId) {
      state.games = state.games.filter((g) => g.id !== gameId);
      persist();
    },

    async setPaidTransfers(gameId, keys) {
      const g = state.games.find((x) => x.id === gameId);
      if (g) g.paidTransfers = keys;
      persist();
    },

    subscribe(_clubId, onChange) {
      dataListeners.add(onChange);
      const onStorage = (e: StorageEvent) => {
        if (e.key === KEY) {
          state = load();
          onChange();
        }
      };
      window.addEventListener('storage', onStorage);
      return () => {
        dataListeners.delete(onChange);
        window.removeEventListener('storage', onStorage);
      };
    },
  };
}
