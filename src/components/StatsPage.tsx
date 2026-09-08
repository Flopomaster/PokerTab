import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { computeStats, headToHead } from '../lib/stats';
import { computeTitles } from '../lib/titles';
import { formatDate, money, signedMoney } from '../lib/format';
import { Avatar, Empty, Stat } from './ui';
import { MultiLineChart } from './Charts';
import type { Series } from './Charts';

export function StatsPage() {
  const { players, games } = useStore();
  const stats = useMemo(() => computeStats(games, players), [games, players]);
  const active = stats.ordered.filter((s) => s.games > 0);
  const titles = useMemo(() => computeTitles(active), [active]);

  const [h2hA, setH2hA] = useState<string>(active[0]?.player.id ?? '');
  const [h2hB, setH2hB] = useState<string>(active[1]?.player.id ?? '');

  const series = useMemo<Series[]>(() => {
    return active.map((s) => {
      let cum = 0;
      let started = false;
      const values = stats.summaries.map((sum) => {
        const r = sum.results.find((x) => x.playerId === s.player.id);
        if (r) {
          cum += r.net;
          started = true;
        }
        return started ? Math.round(cum * 100) / 100 : null;
      });
      return { id: s.player.id, name: s.player.name, color: s.player.color, emoji: s.player.emoji, values };
    });
  }, [active, stats.summaries]);

  const records = useMemo(() => {
    let bestNight = { net: 0, playerId: '', date: '' };
    let worstNight = { net: 0, playerId: '', date: '' };
    let biggestPot = { pot: 0, date: '' };
    let fullestTable = { count: 0, date: '' };
    for (const sum of stats.summaries) {
      for (const r of sum.results) {
        if (r.net > bestNight.net) bestNight = { net: r.net, playerId: r.playerId, date: sum.game.date };
        if (r.net < worstNight.net) worstNight = { net: r.net, playerId: r.playerId, date: sum.game.date };
      }
      if (sum.totalBuyIn > biggestPot.pot) biggestPot = { pot: sum.totalBuyIn, date: sum.game.date };
      if (sum.results.length > fullestTable.count) fullestTable = { count: sum.results.length, date: sum.game.date };
    }
    return { bestNight, worstNight, biggestPot, fullestTable };
  }, [stats.summaries]);

  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? '—';
  const playerOf = (id: string) => players.find((p) => p.id === id);

  const h2h = useMemo(() => (h2hA && h2hB && h2hA !== h2hB ? headToHead(stats.summaries, h2hA, h2hB) : null), [stats.summaries, h2hA, h2hB]);

  if (active.length === 0) {
    return <Empty icon="📈" title="אין עדיין סטטיסטיקות" text="הוסיפו שולחן ראשון והמספרים יתחילו לזרום." />;
  }

  return (
    <div className="fade-in">
      <div className="section-head">
        <div>
          <h1>סטטיסטיקות</h1>
          <p>תארי כבוד, שיאים, גרפים וקרבות ראש בראש.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>🏅 תארי הקבוצה</h2>
          <span className="hint">מתעדכן אוטומטית אחרי כל שולחן</span>
        </div>
        <div className="titles-grid">
          {titles.map((t) => {
            const p = playerOf(t.winnerId);
            return (
              <div className={`title-card ${t.tone}`} key={t.key}>
                <div className="title-emoji">{t.emoji}</div>
                <div className="title-name">{t.name}</div>
                <div className="title-desc">{t.description}</div>
                <div className="title-winner">
                  <Avatar player={p} size="sm" />
                  <div>
                    <div className="title-winner-name">{p?.name ?? '—'}</div>
                    <div className="title-winner-detail">{t.detail}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>📈 מאזן מצטבר לאורך הזמן</h2>
          <span className="hint">לחצו על שם כדי להסתיר/להציג</span>
        </div>
        <MultiLineChart labels={stats.labels} series={series} />
      </div>

      <div className="card">
        <div className="card-title"><h2>🔥 שיאים</h2></div>
        <div className="stat-grid">
          <Stat
            label="השולחן הכי רווחי אי פעם"
            value={signedMoney(records.bestNight.net)}
            sub={records.bestNight.playerId ? `${nameOf(records.bestNight.playerId)} · ${formatDate(records.bestNight.date)}` : '—'}
            tone="pos"
          />
          <Stat
            label="ההפסד הכי כואב"
            value={signedMoney(records.worstNight.net)}
            sub={records.worstNight.playerId ? `${nameOf(records.worstNight.playerId)} · ${formatDate(records.worstNight.date)}` : '—'}
            tone="neg"
          />
          <Stat label="הקופה הגדולה ביותר" value={money(records.biggestPot.pot)} sub={records.biggestPot.date ? formatDate(records.biggestPot.date) : '—'} tone="gold" />
          <Stat label="הכי הרבה שחקנים" value={`${records.fullestTable.count} שחקנים`} sub={records.fullestTable.date ? formatDate(records.fullestTable.date) : '—'} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>⚔️ ראש בראש</h2>
          <span className="hint">רק שולחנות ששניהם שיחקו בהם</span>
        </div>
        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div className="field">
            <label>שחקן א׳</label>
            <select className="select" value={h2hA} onChange={(e) => setH2hA(e.target.value)}>
              {active.map((s) => (
                <option key={s.player.id} value={s.player.id}>{s.player.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>שחקן ב׳</label>
            <select className="select" value={h2hB} onChange={(e) => setH2hB(e.target.value)}>
              {active.map((s) => (
                <option key={s.player.id} value={s.player.id}>{s.player.name}</option>
              ))}
            </select>
          </div>
        </div>

        {!h2h || h2h.games === 0 ? (
          <p className="muted" style={{ fontSize: 14 }}>אין שולחנות משותפים בין השניים (או שנבחר אותו שחקן פעמיים).</p>
        ) : (
          <div className="stat-grid">
            <Stat label="שולחנות משותפים" value={h2h.games} />
            <Stat label={`ניצחונות ${nameOf(h2hA)}`} value={h2h.aWins} sub={`מאזן ${signedMoney(h2h.aNet)} בשולחנות האלה`} tone={h2h.aWins >= h2h.bWins ? 'pos' : undefined} />
            <Stat label={`ניצחונות ${nameOf(h2hB)}`} value={h2h.bWins} sub={`מאזן ${signedMoney(h2h.bNet)} בשולחנות האלה`} tone={h2h.bWins > h2h.aWins ? 'pos' : undefined} />
            <Stat
              label="מי מוביל"
              value={h2h.aNet === h2h.bNet ? 'תיקו' : h2h.aNet > h2h.bNet ? nameOf(h2hA) : nameOf(h2hB)}
              sub={`פער של ${money(Math.abs(h2h.aNet - h2h.bNet))}`}
              tone="gold"
            />
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title"><h2>🪑 נוכחות ורצפים</h2></div>
        <div className="table-wrap">
          <table className="tbl" style={{ minWidth: 620 }}>
            <thead>
              <tr>
                <th>שחקן</th>
                <th>שולחנות</th>
                <th>רצף נוכחי</th>
                <th>רצף ניצחונות הכי ארוך</th>
                <th>רצף הפסדים הכי ארוך</th>
                <th>תנודתיות (±)</th>
              </tr>
            </thead>
            <tbody>
              {active.map((s) => (
                <tr key={s.player.id}>
                  <td className="name-cell">
                    <div className="player-cell"><Avatar player={s.player} size="sm" /> {s.player.name}</div>
                  </td>
                  <td className="num">{s.games}</td>
                  <td className={s.currentStreak > 0 ? 'pos' : s.currentStreak < 0 ? 'neg' : 'muted'}>
                    {s.currentStreak === 0 ? '—' : s.currentStreak > 0 ? `🔥 ${s.currentStreak}` : `🧊 ${-s.currentStreak}`}
                  </td>
                  <td className="num">{s.longestWinStreak}</td>
                  <td className="num">{s.longestLoseStreak}</td>
                  <td className="num muted">{money(s.volatility)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
