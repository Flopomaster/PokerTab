import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../lib/apiClient';
import { errorMessage } from '../lib/api';
import { newId, randomColor, randomEmoji } from '../lib/storage';
import type { Club, Game, ID, Membership, MyMembership, OpenDebt, Player, Profile, Role, Settlement, SignUpInput } from '../types';
import { computeTransfers } from '../lib/settle';
import { summarizeGame } from '../lib/stats';

const ACTIVE_CLUB_KEY = 'pokertab.activeClub';

interface StoreValue {
  /* מצב */
  ready: boolean;
  profile: Profile | null;
  memberships: MyMembership[];
  club: Club | null;
  membership: MyMembership | null;
  isAdmin: boolean;
  players: Player[];
  activePlayers: Player[];
  games: Game[];
  members: Membership[];
  settlements: Settlement[];
  /** חובות שטרם אושרו על ידי המקבל, לפי שחקן משלם */
  openDebts: Map<ID, OpenDebt[]>;
  loadingClub: boolean;
  clubError: string | null;

  /* עזרים */
  playerById: (id: ID) => Player | undefined;
  settlementFor: (gameId: ID, from: ID, to: ID) => Settlement | undefined;
  /** האם המשתמש הנוכחי רשאי לסמן בשם השחקן הזה */
  canActForPlayer: (game: Game, playerId: ID) => boolean;
  myPlayer: Player | null;
  canEditGame: (game: Game) => boolean;

  /* חשבון */
  signUp: (input: SignUpInput) => Promise<void>;
  signIn: (usernameOrEmail: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, 'displayName' | 'emoji' | 'color'>>) => Promise<void>;

  /* קלאבים */
  createClub: (name: string, defaultBuyIn: number) => Promise<Club>;
  joinClub: (code: string) => Promise<{ club: Club; status: string }>;
  selectClub: (clubId: ID) => void;
  leaveClub: (clubId: ID) => Promise<void>;
  updateClub: (patch: Partial<Pick<Club, 'name' | 'defaultBuyIn'>>) => Promise<void>;
  regenerateJoinCode: () => Promise<string>;
  refreshMemberships: () => Promise<void>;

  /* חברים */
  decideMember: (userId: ID, status: 'approved' | 'rejected') => Promise<void>;
  setMemberRole: (userId: ID, role: Role) => Promise<void>;
  removeMember: (userId: ID) => Promise<void>;

  /* נתונים */
  addPlayer: (name: string, emoji?: string, color?: string) => Promise<Player>;
  updatePlayer: (playerId: ID, patch: Partial<Player>) => Promise<void>;
  deletePlayer: (playerId: ID) => Promise<void>;
  saveGame: (game: Game) => Promise<void>;
  deleteGame: (gameId: ID) => Promise<void>;
  toggleTransferPaid: (gameId: ID, key: string) => Promise<void>;
  markTransferSent: (gameId: ID, from: ID, to: ID, value: boolean) => Promise<void>;
  confirmTransferReceived: (gameId: ID, from: ID, to: ID, value: boolean) => Promise<void>;
  reloadClubData: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<MyMembership[]>([]);
  const [activeClubId, setActiveClubId] = useState<ID | null>(() => localStorage.getItem(ACTIVE_CLUB_KEY));
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [members, setMembers] = useState<Membership[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loadingClub, setLoadingClub] = useState(false);
  const [clubError, setClubError] = useState<string | null>(null);

  const loadSeq = useRef(0);

  const refreshMemberships = useCallback(async () => {
    const list = await api.myMemberships();
    setMemberships(list);
    setActiveClubId((current) => {
      const approved = list.filter((m) => m.status === 'approved');
      if (current && approved.some((m) => m.clubId === current)) return current;
      return approved[0]?.clubId ?? null;
    });
  }, []);

  /* טעינה ראשונית ומעקב אחרי שינויי התחברות */
  useEffect(() => {
    let alive = true;
    const boot = async () => {
      try {
        const p = await api.currentProfile();
        if (!alive) return;
        setProfile(p);
        if (p) await refreshMemberships();
      } catch {
        if (alive) setProfile(null);
      } finally {
        if (alive) setReady(true);
      }
    };
    void boot();
    const unsubscribe = api.onAuthChange(() => {
      void (async () => {
        const p = await api.currentProfile();
        if (!alive) return;
        setProfile(p);
        if (p) await refreshMemberships();
        else {
          setMemberships([]);
          setActiveClubId(null);
          setPlayers([]);
          setGames([]);
          setMembers([]);
        }
      })();
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [refreshMemberships]);

  useEffect(() => {
    if (activeClubId) localStorage.setItem(ACTIVE_CLUB_KEY, activeClubId);
    else localStorage.removeItem(ACTIVE_CLUB_KEY);
  }, [activeClubId]);

  const membership = useMemo(
    () => memberships.find((m) => m.clubId === activeClubId) ?? null,
    [memberships, activeClubId],
  );
  const club = membership?.club ?? null;
  const isAdmin = membership?.role === 'admin' && membership.status === 'approved';

  const loadClubData = useCallback(async (clubId: ID) => {
    const seq = ++loadSeq.current;
    setLoadingClub(true);
    try {
      const [data, memberList] = await Promise.all([api.loadClubData(clubId), api.clubMembers(clubId)]);
      if (seq !== loadSeq.current) return;
      setPlayers(data.players);
      setGames(data.games);
      setSettlements(data.settlements);
      setMembers(memberList);
      setClubError(null);
    } catch (e) {
      if (seq === loadSeq.current) setClubError(errorMessage(e));
    } finally {
      if (seq === loadSeq.current) setLoadingClub(false);
    }
  }, []);

  /* נתוני הקלאב הפעיל + עדכונים חיים */
  useEffect(() => {
    if (!activeClubId || membership?.status !== 'approved') {
      setPlayers([]);
      setGames([]);
      setMembers([]);
      setSettlements([]);
      return;
    }
    void loadClubData(activeClubId);
    const unsubscribe = api.subscribe(activeClubId, () => {
      void loadClubData(activeClubId);
    });
    return unsubscribe;
  }, [activeClubId, membership?.status, loadClubData]);

  const reloadClubData = useCallback(async () => {
    if (activeClubId) await loadClubData(activeClubId);
  }, [activeClubId, loadClubData]);

  const requireClub = useCallback((): ID => {
    if (!activeClubId) throw new Error('אין קלאב פעיל');
    return activeClubId;
  }, [activeClubId]);

  const myPlayer = useMemo(
    () => players.find((p) => p.userId && p.userId === profile?.id) ?? null,
    [players, profile],
  );

  const canEditGame = useCallback(
    (game: Game) => isAdmin || (!!profile && game.dealerId === profile.id),
    [isAdmin, profile],
  );

  /* אותו כלל כמו בשרת: שחקן מקושר — רק בעל החשבון; אורח — הדילר או אדמין */
  const canActForPlayer = useCallback(
    (game: Game, playerId: ID) => {
      const player = players.find((p) => p.id === playerId);
      if (!player) return false;
      if (player.userId) return player.userId === profile?.id;
      return isAdmin || (!!profile && game.dealerId === profile.id);
    },
    [players, profile, isAdmin],
  );

  const settlementFor = useCallback(
    (gameId: ID, from: ID, to: ID) =>
      settlements.find((x) => x.gameId === gameId && x.fromPlayer === from && x.toPlayer === to),
    [settlements],
  );

  /* חובות פתוחים: העברה משולחן סגור שהמקבל עדיין לא אישר */
  const openDebts = useMemo(() => {
    const map = new Map<ID, OpenDebt[]>();
    for (const game of games) {
      if (game.status === 'live') continue;
      const summary = summarizeGame(game);
      const transfers = computeTransfers(summary.results.map((r) => ({ id: r.playerId, net: r.net })));
      for (const t of transfers) {
        const settled = settlements.find(
          (x) => x.gameId === game.id && x.fromPlayer === t.from && x.toPlayer === t.to,
        );
        if (settled?.receiverConfirmed) continue;
        const list = map.get(t.from) ?? [];
        list.push({
          gameId: game.id,
          date: game.date,
          toPlayerId: t.to,
          amount: t.amount,
          senderMarked: !!settled?.senderMarked,
        });
        map.set(t.from, list);
      }
    }
    return map;
  }, [games, settlements]);

  const value = useMemo<StoreValue>(() => {
    return {
      ready,
      profile,
      memberships,
      club,
      membership,
      isAdmin,
      players,
      activePlayers: players.filter((p) => !p.archived),
      games,
      members,
      settlements,
      openDebts,
      loadingClub,
      clubError,
      playerById: (id: ID) => players.find((p) => p.id === id),
      settlementFor,
      canActForPlayer,
      myPlayer,
      canEditGame,

      async signUp(input) {
        const p = await api.signUp(input);
        setProfile(p);
        await refreshMemberships();
      },
      async signIn(usernameOrEmail, password) {
        const p = await api.signIn(usernameOrEmail, password);
        setProfile(p);
        await refreshMemberships();
      },
      async signOut() {
        await api.signOut();
        setProfile(null);
        setMemberships([]);
        setActiveClubId(null);
      },
      async updateProfile(patch) {
        const p = await api.updateProfile(patch);
        setProfile(p);
        await reloadClubData();
      },

      async createClub(name, defaultBuyIn) {
        const created = await api.createClub(name, defaultBuyIn);
        await refreshMemberships();
        setActiveClubId(created.id);
        return created;
      },
      async joinClub(code) {
        const result = await api.joinClub(code);
        await refreshMemberships();
        if (result.status === 'approved') setActiveClubId(result.club.id);
        return result;
      },
      selectClub(clubId) {
        setActiveClubId(clubId);
      },
      async leaveClub(clubId) {
        await api.leaveClub(clubId);
        setActiveClubId(null);
        await refreshMemberships();
      },
      async updateClub(patch) {
        await api.updateClub(requireClub(), patch);
        await refreshMemberships();
      },
      async regenerateJoinCode() {
        const code = await api.regenerateJoinCode(requireClub());
        await refreshMemberships();
        return code;
      },
      refreshMemberships,

      async decideMember(userId, status) {
        await api.decideMember(requireClub(), userId, status);
        await reloadClubData();
      },
      async setMemberRole(userId, role) {
        await api.setMemberRole(requireClub(), userId, role);
        await reloadClubData();
      },
      async removeMember(userId) {
        await api.removeMember(requireClub(), userId);
        await reloadClubData();
      },

      async addPlayer(name, emoji, color) {
        const player = await api.createPlayer(requireClub(), {
          name,
          emoji: emoji ?? randomEmoji(),
          color: color ?? randomColor(),
        });
        setPlayers((prev) => [...prev, player]);
        return player;
      },
      async updatePlayer(playerId, patch) {
        await api.updatePlayer(playerId, patch);
        setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, ...patch } : p)));
      },
      async deletePlayer(playerId) {
        await api.deletePlayer(playerId);
        await reloadClubData();
      },
      async saveGame(game) {
        const isNew = !games.some((g) => g.id === game.id);
        const saved = await api.saveGame(game, isNew);
        setGames((prev) => {
          const exists = prev.some((g) => g.id === saved.id);
          return exists ? prev.map((g) => (g.id === saved.id ? saved : g)) : [...prev, saved];
        });
      },
      async deleteGame(gameId) {
        await api.deleteGame(gameId);
        setGames((prev) => prev.filter((g) => g.id !== gameId));
      },
      async toggleTransferPaid(gameId, key) {
        const game = games.find((g) => g.id === gameId);
        if (!game) return;
        const next = game.paidTransfers.includes(key)
          ? game.paidTransfers.filter((k) => k !== key)
          : [...game.paidTransfers, key];
        setGames((prev) => prev.map((g) => (g.id === gameId ? { ...g, paidTransfers: next } : g)));
        await api.setPaidTransfers(gameId, next);
      },
      async markTransferSent(gameId, from, to, value) {
        setSettlements((prev) => {
          const exists = prev.some((x) => x.gameId === gameId && x.fromPlayer === from && x.toPlayer === to);
          return exists
            ? prev.map((x) =>
                x.gameId === gameId && x.fromPlayer === from && x.toPlayer === to ? { ...x, senderMarked: value } : x,
              )
            : [...prev, { gameId, fromPlayer: from, toPlayer: to, senderMarked: value, receiverConfirmed: false }];
        });
        try {
          await api.markTransferSent(gameId, from, to, value);
        } finally {
          await reloadClubData();
        }
      },
      async confirmTransferReceived(gameId, from, to, value) {
        setSettlements((prev) => {
          const exists = prev.some((x) => x.gameId === gameId && x.fromPlayer === from && x.toPlayer === to);
          return exists
            ? prev.map((x) =>
                x.gameId === gameId && x.fromPlayer === from && x.toPlayer === to
                  ? { ...x, receiverConfirmed: value }
                  : x,
              )
            : [...prev, { gameId, fromPlayer: from, toPlayer: to, senderMarked: false, receiverConfirmed: value }];
        });
        try {
          await api.confirmTransferReceived(gameId, from, to, value);
        } finally {
          await reloadClubData();
        }
      },
      reloadClubData,
    };
  }, [
    ready, profile, memberships, club, membership, isAdmin, players, games, members, settlements, openDebts,
    loadingClub, clubError, myPlayer, canEditGame, canActForPlayer, settlementFor,
    refreshMemberships, reloadClubData, requireClub,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

export { newId };
