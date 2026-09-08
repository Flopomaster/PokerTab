import type { PlayerStats, GameSummary } from '../lib/stats';
import { formatDate, money, ordinalHe, signedMoney } from '../lib/format';
import { Avatar, Modal, Stat } from './ui';
import { BarChart } from './Charts';

export function PlayerModal({ stats, summaries, onClose }: { stats: PlayerStats; summaries: GameSummary[]; onClose: () => void }) {
  const played = summaries
    .filter((s) => s.results.some((r) => r.playerId === stats.player.id))
    .map((s) => ({ summary: s, result: s.results.find((r) => r.playerId === stats.player.id)! }));

  const streakText =
    stats.currentStreak > 0
      ? `🔥 ${stats.currentStreak} ניצחונות ברצף`
      : stats.currentStreak < 0
        ? `🧊 ${-stats.currentStreak} הפסדים ברצף`
        : '—';

  return (
    <Modal title="כרטיס שחקן" onClose={onClose} wide>
      <div className="row" style={{ gap: 14, marginBottom: 18 }}>
        <Avatar player={stats.player} size="lg" />
        <div>
          <h2 style={{ fontSize: 22 }}>{stats.player.name}</h2>
          <p className="muted" style={{ fontSize: 13 }}>
            {stats.games} שולחנות · {stats.lastPlayed ? `אחרון: ${formatDate(stats.lastPlayed)}` : 'עוד לא שיחק'}
          </p>
        </div>
        <div className="spacer" />
        <div className={`lb-net ${stats.net > 0 ? 'pos' : stats.net < 0 ? 'neg' : 'muted'}`} style={{ fontSize: 24 }}>
          {signedMoney(stats.net)}
        </div>
      </div>

      {stats.games === 0 ? (
        <p className="muted" style={{ fontSize: 14 }}>עוד לא שיחק אף שולחן.</p>
      ) : (
        <>
          <div className="stat-grid" style={{ marginBottom: 16 }}>
            <Stat label="ממוצע לשולחן" value={signedMoney(stats.avgNet)} tone={stats.avgNet >= 0 ? 'pos' : 'neg'} />
            <Stat label="ROI" value={`${(stats.roi * 100).toFixed(1)}%`} sub={`על ${money(stats.totalBuyIn)} כניסות`} />
            <Stat label="ניצחונות" value={stats.wins} sub={`${stats.podiums} פודיומים`} tone="gold" />
            <Stat label="מקום ממוצע" value={stats.avgRank.toFixed(1)} sub={`${stats.lastPlaces} פעמים אחרון`} />
            <Stat label="השולחן הכי טוב" value={signedMoney(stats.bestNight)} sub={stats.bestNightDate ? formatDate(stats.bestNightDate) : ''} tone="pos" />
            <Stat label="השולחן הכי גרוע" value={signedMoney(stats.worstNight)} sub={stats.worstNightDate ? formatDate(stats.worstNightDate) : ''} tone="neg" />
            <Stat label="רצף נוכחי" value={streakText} sub={`הכי ארוך: ${stats.longestWinStreak}W / ${stats.longestLoseStreak}L`} />
            <Stat label="שולחנות ברווח" value={`${Math.round(stats.itmRate * 100)}%`} sub={`${stats.profitableNights} מתוך ${stats.games}`} />
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title"><h2>רווח/הפסד לפי שולחן</h2></div>
            <BarChart labels={played.map((p) => p.summary.game.date)} values={played.map((p) => p.result.net)} />
          </div>

          <div className="table-wrap">
            <table className="tbl" style={{ minWidth: 420 }}>
              <thead>
                <tr>
                  <th>תאריך</th>
                  <th>מקום</th>
                  <th>נכנס</th>
                  <th>יצא</th>
                  <th>מאזן</th>
                </tr>
              </thead>
              <tbody>
                {[...played].reverse().map(({ summary, result }) => (
                  <tr key={summary.game.id}>
                    <td>{formatDate(summary.game.date)}</td>
                    <td className="muted">{ordinalHe(result.rank)}</td>
                    <td className="num muted">{money(result.buyIn)}</td>
                    <td className="num">{money(result.cashOut)}</td>
                    <td className={`num ${result.net > 0 ? 'pos' : result.net < 0 ? 'neg' : 'muted'}`} style={{ fontWeight: 800 }}>
                      {signedMoney(result.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
