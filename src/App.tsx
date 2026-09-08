import { useEffect, useState } from 'react';
import { useStore } from './state/store';
import { Dashboard } from './components/Dashboard';
import { GamesPage } from './components/GamesPage';
import { GameEditor } from './components/GameEditor';
import { GameDetail } from './components/GameDetail';
import { Leaderboard } from './components/Leaderboard';
import { StatsPage } from './components/StatsPage';
import { PlayersPage } from './components/PlayersPage';
import { SettingsPage } from './components/SettingsPage';

type Tab = 'home' | 'games' | 'leaderboard' | 'stats' | 'players' | 'settings';

type View =
  | { kind: 'tab'; tab: Tab }
  | { kind: 'game'; id: string }
  | { kind: 'editor'; gameId: string | null };

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'ראשי', icon: '🏠' },
  { id: 'games', label: 'ערבים', icon: '📅' },
  { id: 'leaderboard', label: 'לוח מובילים', icon: '🏆' },
  { id: 'stats', label: 'סטטיסטיקות', icon: '📈' },
  { id: 'players', label: 'שחקנים', icon: '👥' },
  { id: 'settings', label: 'הגדרות', icon: '⚙️' },
];

export default function App() {
  const { data } = useStore();
  const [view, setView] = useState<View>({ kind: 'tab', tab: 'home' });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [view]);

  const goTab = (tab: Tab) => setView({ kind: 'tab', tab });
  const openGame = (id: string) => setView({ kind: 'game', id });
  const newGame = () => setView({ kind: 'editor', gameId: null });

  const activeTab = view.kind === 'tab' ? view.tab : view.kind === 'editor' ? 'games' : 'games';
  const currentGame = view.kind === 'game' ? data.games.find((g) => g.id === view.id) : undefined;
  const editingGame = view.kind === 'editor' && view.gameId ? data.games.find((g) => g.id === view.gameId) ?? null : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">🃏</div>
          <div>
            <div className="brand-title">PokerTab</div>
            <div className="brand-sub">מי חייב למי, וכמה — בלי ויכוחים</div>
          </div>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`tab${activeTab === t.id && view.kind === 'tab' ? ' active' : ''}`} onClick={() => goTab(t.id)}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {view.kind === 'editor' && (
          <GameEditor
            game={editingGame}
            onDone={(id) => {
              openGame(id);
              setToast(editingGame ? 'הערב עודכן ✓' : 'הערב נשמר ✓');
            }}
            onCancel={() => (editingGame ? openGame(editingGame.id) : goTab('games'))}
          />
        )}

        {view.kind === 'game' &&
          (currentGame ? (
            <GameDetail
              game={currentGame}
              onBack={() => goTab('games')}
              onEdit={() => setView({ kind: 'editor', gameId: currentGame.id })}
              onToast={setToast}
            />
          ) : (
            <div className="empty">הערב לא נמצא.</div>
          ))}

        {view.kind === 'tab' && view.tab === 'home' && <Dashboard onNewGame={newGame} onOpenGame={openGame} onGoto={(t) => goTab(t as Tab)} />}
        {view.kind === 'tab' && view.tab === 'games' && <GamesPage onNewGame={newGame} onOpenGame={openGame} />}
        {view.kind === 'tab' && view.tab === 'leaderboard' && <Leaderboard />}
        {view.kind === 'tab' && view.tab === 'stats' && <StatsPage />}
        {view.kind === 'tab' && view.tab === 'players' && <PlayersPage />}
        {view.kind === 'tab' && view.tab === 'settings' && <SettingsPage onToast={setToast} />}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
