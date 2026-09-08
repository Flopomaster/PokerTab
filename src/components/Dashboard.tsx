import { useMemo } from 'react';
import { useStore } from '../state/store';
import { computeStats, sortGames } from '../lib/stats';
import { computeTransfers } from '../lib/settle';
import { formatDate, money, round2, signedMoney } from '../lib/format';
import { Avatar, Empty, Stat } from './ui';

export function Dashboard({ onNewGame, onOpenGame, onGoto }: { onNewGame: () => void; onOpenGame: (id: string) => void; onGoto: (tab: string) => void }) {
  const { players, games, club, isAdmin, members } = useStore();
  const pendingRequests = members.filter((m) => m.status === 'pending');
  const stats = useMemo(() => computeStats(games, players), [games, players]);

  const liveGame = games.find((g) => g.status === 'live');
  const livePot = liveGame
    ? round2(liveGame.entries.reduce((sum, e) => sum + e.buyIns * liveGame.buyInAmount + e.extraBuyIn, 0))
    : 0;
  const lastSummary = stats.summaries[stats.summaries.length - 1];
  const lastTransfers = useMemo(
    () => (lastSummary ? computeTransfers(lastSummary.results.map((r) => ({ id: r.playerId, net: r.net }))) : []),
    [lastSummary],
  );

  const totalPot = round2(stats.summaries.reduce((s, g) => s + g.totalBuyIn, 0));
  const activeStats = stats.ordered.filter((s) => s.games > 0);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? '—';
  const playerOf = (id: string) => players.find((p) => p.id === id);

  const liveCard = liveGame ? (
      <button className="live-card" onClick={() => onOpenGame(liveGame.id)}>
        <div className="row between" style={{ width: '100%' }}>
          <div className="live-badge"><span className="live-dot" /> ערב מתנהל עכשיו</div>
          <span className="chip gold">לניהול →</span>
        </div>
        <div className="row" style={{ gap: 16, marginTop: 10, width: '100%' }}>
          <div>
            <div className="label muted" style={{ fontSize: 12 }}>בקופה</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--gold)' }}>{money(livePot)}</div>
          </div>
          <div>
            <div className="label muted" style={{ fontSize: 12 }}>שחקנים</div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>{liveGame.entries.length}</div>
          </div>
          <span className="spacer" />
          <div className="stack-avatars">
            {liveGame.entries.slice(0, 5).map((e) => (
              <Avatar key={e.playerId} player={playerOf(e.playerId)} size="sm" />
            ))}
          </div>
        </div>
      </button>
      ) : null;

  const pendingBanner = isAdmin && pendingRequests.length > 0 ? (
        <button className="pending-banner" onClick={() => onGoto('club')}>
          <span style={{ fontSize: 22 }}>⏳</span>
          <div>
            <div style={{ fontWeight: 900 }}>
              {pendingRequests.length === 1
                ? `${pendingRequests[0].profile?.displayName ?? 'מישהו'} מבקש להצטרף לקלאב`
                : `${pendingRequests.length} בקשות הצטרפות ממתינות לאישור`}
            </div>
            <div className="lb-sub">לחצו כדי לאשר או לדחות</div>
          </div>
          <span className="spacer" />
          <span className="chip gold">לאישור →</span>
        </button>
      ) : null;

  // ערב שמתנהל עכשיו מוצג בנפרד ואינו נחשב ערב שנרשם
  const closedGames = games.filter((g) => g.status !== 'live');

  if (closedGames.length === 0) {
    return (
      <div className="fade-in">
        <div className="section-head">
          <div>
            <h1>{club?.name ?? 'הקלאב'}</h1>
            <p>הכל מתחיל בערב הראשון.</p>
          </div>
        </div>
      {liveCard}

      {pendingBanner}

        <Empty
          icon="🃏"
          title="עוד לא נרשם אף ערב"
          text="הוסיפו את הערב הראשון — כמה כל אחד נכנס, כמה יצא, והאפליקציה תחשב מי מעביר למי."
          action={
            <button className="btn btn-primary" onClick={onNewGame}>+ ערב חדש</button>
          }
        />
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title"><h2>איך זה עובד</h2></div>
          <ol className="muted" style={{ fontSize: 13.5, lineHeight: 2, paddingInlineStart: 20, margin: 0 }}>
            <li>מוסיפים את השחקנים ואת סכום הכניסה של הערב.</li>
            <li>בסוף הערב מזינים כמה כל אחד יצא עם — הקופה חייבת להתאזן.</li>
            <li>מקבלים רשימת העברות מינימלית, מעתיקים לוואטסאפ, וזהו.</li>
            <li>כל ערב נשמר ומזין את לוח המובילים, התארים והגרפים.</li>
          </ol>
        </div>
      </div>
    );
  }

  const recent = sortGames(closedGames).slice(-4).reverse();

  return (
    <div className="fade-in">
      <div className="section-head">
        <div>
          <h1>{club?.name ?? 'הקלאב'}</h1>
          <p>{closedGames.length} ערבים · {activeStats.length} שחקנים · {money(totalPot)} עברו על השולחן</p>
        </div>
        <button className="btn btn-primary" onClick={onNewGame} disabled={!!liveGame}>+ ערב חדש</button>
      </div>

      {liveCard}

      {pendingBanner}

      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <Stat label="ערבים שנרשמו" value={closedGames.length} sub={stats.summaries[0] ? `מאז ${formatDate(stats.summaries[0].game.date)}` : undefined} />
        <Stat label="סה״כ קופה" value={money(totalPot)} sub={`ממוצע ${money(round2(totalPot / Math.max(1, closedGames.length)))} לערב`} tone="gold" />
        <Stat
          label="המוביל"
          value={activeStats[0] ? `${activeStats[0].player.emoji} ${activeStats[0].player.name}` : '—'}
          sub={activeStats[0] ? signedMoney(activeStats[0].net) : undefined}
          tone="pos"
        />
        <Stat
          label="הבנקומט"
          value={
            activeStats.length > 0
              ? `${activeStats[activeStats.length - 1].player.emoji} ${activeStats[activeStats.length - 1].player.name}`
              : '—'
          }
          sub={activeStats.length > 0 ? signedMoney(activeStats[activeStats.length - 1].net) : undefined}
          tone="neg"
        />
      </div>

      {lastSummary && (
        <div className="card">
          <div className="card-title">
            <h2>🎯 הערב האחרון</h2>
            <span className="hint">{formatDate(lastSummary.game.date)}</span>
          </div>
          <div className="row between" style={{ marginBottom: 12 }}>
            <div className="row" style={{ gap: 8 }}>
              {lastSummary.results.slice(0, 3).map((r) => (
                <span key={r.playerId} className={`chip ${r.net > 0 ? 'pos' : r.net < 0 ? 'neg' : ''}`}>
                  {playerOf(r.playerId)?.emoji} {nameOf(r.playerId)} {signedMoney(r.net)}
                </span>
              ))}
            </div>
            <button className="btn btn-sm" onClick={() => onOpenGame(lastSummary.game.id)}>לערב המלא →</button>
          </div>
          {lastTransfers.length === 0 ? (
            <p className="muted" style={{ fontSize: 13.5 }}>אין העברות פתוחות בערב הזה.</p>
          ) : (
            <div>
              {lastTransfers.slice(0, 3).map((t) => (
                <div className="transfer" key={`${t.from}>${t.to}`}>
                  <div className="transfer-flow">
                    <span className="transfer-who"><Avatar player={playerOf(t.from)} size="sm" /> {nameOf(t.from)}</span>
                    <span className="transfer-arrow">←</span>
                    <span className="transfer-who"><Avatar player={playerOf(t.to)} size="sm" /> {nameOf(t.to)}</span>
                  </div>
                  <span className="transfer-amount">{money(t.amount)}</span>
                </div>
              ))}
              {lastTransfers.length > 3 && (
                <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>ועוד {lastTransfers.length - 3} העברות...</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-title">
          <h2>🏆 צמרת הטבלה</h2>
          <button className="btn btn-sm btn-ghost" onClick={() => onGoto('leaderboard')}>לטבלה המלאה →</button>
        </div>
        {activeStats.slice(0, 5).map((s, i) => (
          <div className={`lb-row${i === 0 ? ' top' : ''}`} key={s.player.id} onClick={() => onGoto('leaderboard')}>
            <div className={`rank-pill r${i + 1}`}>{i + 1}</div>
            <div className="lb-main">
              <Avatar player={s.player} />
              <div style={{ minWidth: 0 }}>
                <div className="lb-name">{s.player.name}</div>
                <div className="lb-sub">{s.games} ערבים · ממוצע {signedMoney(s.avgNet)}</div>
              </div>
            </div>
            <div className={`lb-net ${s.net > 0 ? 'pos' : s.net < 0 ? 'neg' : 'muted'}`}>{signedMoney(s.net)}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">
          <h2>📅 ערבים אחרונים</h2>
          <button className="btn btn-sm btn-ghost" onClick={() => onGoto('games')}>כל הערבים →</button>
        </div>
        {recent.map((g) => {
          const s = stats.summaries.find((x) => x.game.id === g.id);
          const winner = s?.results[0];
          return (
            <div className="game-row" key={g.id} onClick={() => onOpenGame(g.id)}>
              <div>
                <div className="game-date">{formatDate(g.date)}</div>
                <div className="game-meta">
                  {g.entries.length} שחקנים · קופה {money(s?.totalBuyIn ?? 0)}
                  {winner ? ` · 🥇 ${nameOf(winner.playerId)}` : ''}
                </div>
              </div>
              <div className="stack-avatars">
                {g.entries.slice(0, 5).map((e) => (
                  <Avatar key={e.playerId} player={playerOf(e.playerId)} size="sm" />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
