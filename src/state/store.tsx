import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppData, Game, ID, Player, Settings } from '../types';
import { emptyData, loadData, newId, normalize, PLAYER_COLORS, PLAYER_EMOJIS, saveData } from '../lib/storage';

interface StoreValue {
  data: AppData;
  activePlayers: Player[];
  playerById: (id: ID) => Player | undefined;
  addPlayer: (name: string, emoji?: string, color?: string) => Player;
  updatePlayer: (id: ID, patch: Partial<Player>) => void;
  deletePlayer: (id: ID) => void;
  saveGame: (game: Game) => void;
  deleteGame: (id: ID) => void;
  toggleTransferPaid: (gameId: ID, key: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  replaceAll: (raw: unknown) => void;
  resetAll: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData());

  useEffect(() => {
    saveData(data);
  }, [data]);

  const addPlayer = useCallback((name: string, emoji?: string, color?: string) => {
    const player: Player = {
      id: newId(),
      name: name.trim(),
      emoji: emoji || PLAYER_EMOJIS[Math.floor(Math.random() * PLAYER_EMOJIS.length)],
      color: color || PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
      createdAt: new Date().toISOString(),
    };
    setData((d) => ({ ...d, players: [...d.players, player] }));
    return player;
  }, []);

  const updatePlayer = useCallback((id: ID, patch: Partial<Player>) => {
    setData((d) => ({ ...d, players: d.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  }, []);

  const deletePlayer = useCallback((id: ID) => {
    setData((d) => ({
      ...d,
      players: d.players.filter((p) => p.id !== id),
      games: d.games.map((g) => ({ ...g, entries: g.entries.filter((e) => e.playerId !== id) })),
    }));
  }, []);

  const saveGame = useCallback((game: Game) => {
    setData((d) => {
      const exists = d.games.some((g) => g.id === game.id);
      return {
        ...d,
        games: exists ? d.games.map((g) => (g.id === game.id ? game : g)) : [...d.games, game],
      };
    });
  }, []);

  const deleteGame = useCallback((id: ID) => {
    setData((d) => ({ ...d, games: d.games.filter((g) => g.id !== id) }));
  }, []);

  const toggleTransferPaid = useCallback((gameId: ID, key: string) => {
    setData((d) => ({
      ...d,
      games: d.games.map((g) => {
        if (g.id !== gameId) return g;
        const paid = g.paidTransfers.includes(key)
          ? g.paidTransfers.filter((k) => k !== key)
          : [...g.paidTransfers, key];
        return { ...g, paidTransfers: paid };
      }),
    }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }, []);

  const replaceAll = useCallback((raw: unknown) => {
    setData(normalize(raw));
  }, []);

  const resetAll = useCallback(() => setData(emptyData()), []);

  const value = useMemo<StoreValue>(
    () => ({
      data,
      activePlayers: data.players.filter((p) => !p.archived),
      playerById: (id: ID) => data.players.find((p) => p.id === id),
      addPlayer,
      updatePlayer,
      deletePlayer,
      saveGame,
      deleteGame,
      toggleTransferPaid,
      updateSettings,
      replaceAll,
      resetAll,
    }),
    [data, addPlayer, updatePlayer, deletePlayer, saveGame, deleteGame, toggleTransferPaid, updateSettings, replaceAll, resetAll],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
