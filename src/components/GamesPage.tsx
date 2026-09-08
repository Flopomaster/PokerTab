import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { computeStats, sortGames } from '../lib/stats';
import { formatDate, money, signedMoney } from '../lib/format';
import { Avatar, Empty } from './ui';

export function GamesPage({ onNewGame, onOpenGame }: { onNewGame: () => void; onOpenGame: (id: string) => void }) {
  const { players, games } = useStore();
  const liveGame = games.find((g) => g.status === 'live');
  const stats = useMemo(() => computeStats(games, players), [games, players]);
  const [filter, setFilter] = useState<string>('all');

  const playerOf = (id: string) => players.find((p) => p.id === id);
  const visibleGames = useMemo(() => {
    const all = sortGames(games).reverse();
    if (filter === 'all') return all;
    return all.filter((g) => g.entries.some((e) => e.playerId === filter));
  }, [games, filter]);

  if (games.length === 0) {
    return (
      <Empty
        icon="📅"
        title="אין עדיין שולחנות"
        text="כל שולחן שתוסיפו יופיע כאן עם התוצאות וההעברות שלו."
        action={<button className="btn btn-primary" onClick={onNewGame}>+ שולחן חדש</button>}
      />
    );
  }

  return (
    <div className="fade-in">
      <div className="section-head">
        <div>
          <h1>היסטוריית שולחנות</h1>
          <p>{visibleGames.length} שולחנות · לחיצה פותחת את הסיכום וההעברות.</p>
        </div>
        <button className="btn btn-primary" onClick={onNewGame} disabled={!!liveGame}>+ שולחן חדש</button>
      </div>

      {liveGame && (
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
          יש שולחן שמתנהל עכשיו — צריך לסגור אותו לפני שפותחים חדש.
        </p>
      )}

      <div className="row" style={{ marginBottom: 14, gap: 8 }}>
        <button className={`chip${filter === 'all' ? ' gold' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setFilter('all')}>
          הכל
        </button>
        {players.map((p) => (
          <button key={p.id} className={`chip${filter === p.id ? ' gold' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setFilter(p.id)}>
            {p.emoji} {p.name}
          </button>
        ))}
      </div>

      <div className="card">
        {visibleGames.map((g) => {
          const s = stats.summaries.find((x) => x.game.id === g.id);
          const winner = s?.results[0];
          return (
            <div className="game-row" key={g.id} onClick={() => onOpenGame(g.id)}>
              <div style={{ minWidth: 0 }}>
                <div className="game-date">
                  {formatDate(g.date)} {g.title && <span className="muted" style={{ fontWeight: 500 }}>· {g.title}</span>}
                </div>
                {g.status === 'live' && (
                  <div className="live-badge" style={{ marginTop: 6 }}><span className="live-dot" /> מתנהל עכשיו</div>
                )}
                <div className="game-meta">
                  {g.entries.length} שחקנים · קופה {money(s?.totalBuyIn ?? 0)}
                  {g.location ? ` · ${g.location}` : ''}
                  {g.status !== 'live' && !s?.balanced ? ' · ⚠️ לא מאוזן' : ''}
                </div>
                {g.status !== 'live' && winner && (
                  <div className="row" style={{ marginTop: 7, gap: 6 }}>
                    <span className="chip pos">🥇 {playerOf(winner.playerId)?.name} {signedMoney(winner.net)}</span>
                    {s && s.results.length > 1 && (
                      <span className="chip neg">
                        🏧 {playerOf(s.results[s.results.length - 1].playerId)?.name} {signedMoney(s.results[s.results.length - 1].net)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="stack-avatars">
                {g.entries.slice(0, 6).map((e) => (
                  <Avatar key={e.playerId} player={playerOf(e.playerId)} size="sm" />
                ))}
              </div>
            </div>
          );
        })}
        {visibleGames.length === 0 && <p className="muted" style={{ fontSize: 14 }}>אין שולחנות שתואמים לסינון.</p>}
      </div>
    </div>
  );
}
