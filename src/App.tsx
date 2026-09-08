import { useEffect, useState } from 'react';
import { useStore } from './state/store';
import { isDemoMode } from './lib/apiClient';
import { Dashboard } from './components/Dashboard';
import { GamesPage } from './components/GamesPage';
import { GameEditor } from './components/GameEditor';
import { GameDetail } from './components/GameDetail';
import { LiveGame } from './components/LiveGame';
import { Leaderboard } from './components/Leaderboard';
import { StatsPage } from './components/StatsPage';
import { PlayersPage } from './components/PlayersPage';
import { SettingsPage } from './components/SettingsPage';
import { AuthScreen } from './components/auth/AuthScreen';
import { ClubGate } from './components/clubs/ClubGate';
import { ClubSwitcher } from './components/clubs/ClubSwitcher';
import { AdminPanel } from './components/clubs/AdminPanel';
import { AppIcon } from './icons/AppIcon';

type Tab = 'home' | 'games' | 'leaderboard' | 'stats' | 'players' | 'club' | 'settings';

type View =
  | { kind: 'tab'; tab: Tab }
  | { kind: 'game'; id: string }
  | { kind: 'live'; id: string }
  | { kind: 'editor'; gameId: string | null };

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'ראשי', icon: '🏠' },
  { id: 'games', label: 'ערבים', icon: '📅' },
  { id: 'leaderboard', label: 'לוח מובילים', icon: '🏆' },
  { id: 'stats', label: 'סטטיסטיקות', icon: '📈' },
  { id: 'players', label: 'שחקנים', icon: '👥' },
  { id: 'club', label: 'הקלאב', icon: '🏛️' },
  { id: 'settings', label: 'הגדרות', icon: '⚙️' },
];

export default function App() {
  const { ready, profile, club, membership, games, members, isAdmin, loadingClub, clubError, reloadClubData } = useStore();
  const [view, setView] = useState<View>({ kind: 'tab', tab: 'home' });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [view]);

  // החלפת קלאב מחזירה למסך הראשי
  useEffect(() => {
    setView({ kind: 'tab', tab: 'home' });
  }, [club?.id]);

  if (!ready) {
    return (
      <div className="boot">
        <AppIcon size={72} />
        <p className="muted" style={{ marginTop: 14, fontSize: 14 }}>טוען...</p>
      </div>
    );
  }

  if (!profile) return <AuthScreen />;

  const goTab = (tab: Tab) => setView({ kind: 'tab', tab });
  const openGame = (id: string) => {
    // ערב שעדיין מתנהל נפתח במסך הניהול החי ולא בסיכום
    const g = games.find((x) => x.id === id);
    setView(g?.status === 'live' ? { kind: 'live', id } : { kind: 'game', id });
  };
  const newGame = () => setView({ kind: 'editor', gameId: null });

  const pendingCount = members.filter((m) => m.status === 'pending').length;
  const currentGame = view.kind === 'game' || view.kind === 'live' ? games.find((g) => g.id === view.id) : undefined;
  const editingGame = view.kind === 'editor' && view.gameId ? games.find((g) => g.id === view.gameId) ?? null : null;

  const header = (
    <header className="topbar">
      <div className="row between" style={{ gap: 10 }}>
        <div className="brand">
          <div className="brand-mark"><AppIcon size={44} /></div>
          <div>
            <div className="brand-title">PokerTab</div>
            <div className="brand-sub">מי חייב למי, וכמה — בלי ויכוחים</div>
          </div>
        </div>
        <ClubSwitcher />
      </div>
      {club && membership?.status === 'approved' && (
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`tab${view.kind === 'tab' && view.tab === t.id ? ' active' : ''}`} onClick={() => goTab(t.id)}>
              <span>{t.icon}</span> {t.label}
              {t.id === 'club' && isAdmin && pendingCount > 0 && <span className="tab-badge">{pendingCount}</span>}
            </button>
          ))}
        </nav>
      )}
    </header>
  );

  const noClub = !club || membership?.status !== 'approved';

  return (
    <div className="app">
      {isDemoMode && (
        <div className="demo-bar">
          מצב הדגמה — אין חיבור לשרת, והנתונים נשמרים בדפדפן הזה בלבד
        </div>
      )}
      {header}

      <main>
        {noClub ? (
          <ClubGate />
        ) : (
          <>
            {clubError && (
              <div className="balance-banner bad" style={{ marginBottom: 14, justifyContent: 'space-between' }}>
                <span>לא הצלחתי לטעון את נתוני הקלאב: {clubError}</span>
                <button className="btn btn-sm" onClick={() => void reloadClubData()}>נסה שוב</button>
              </div>
            )}
            {loadingClub && games.length === 0 && !clubError && <div className="empty">טוען את נתוני הקלאב...</div>}

            {view.kind === 'editor' && (
              <GameEditor
                game={editingGame}
                onDone={(id) => {
                  setView(editingGame ? { kind: 'game', id } : { kind: 'live', id });
                  setToast(editingGame ? 'הערב עודכן ✓' : 'הערב התחיל 🎲');
                }}
                onCancel={() => (editingGame ? openGame(editingGame.id) : goTab('games'))}
              />
            )}

            {view.kind === 'live' &&
              (currentGame ? (
                <LiveGame
                  game={currentGame}
                  onClose={(id) => (id ? setView({ kind: 'game', id }) : goTab('home'))}
                  onToast={setToast}
                />
              ) : (
                <div className="empty">הערב לא נמצא.</div>
              ))}

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
            {view.kind === 'tab' && view.tab === 'club' && <AdminPanel onToast={setToast} />}
            {view.kind === 'tab' && view.tab === 'settings' && <SettingsPage onToast={setToast} />}
          </>
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
