import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { computeStats } from '../lib/stats';
import type { PlayerStats } from '../lib/stats';
import { money, signedMoney } from '../lib/format';
import { Avatar, Empty } from './ui';
import { PlayerModal } from './PlayerModal';

type SortKey = 'net' | 'games' | 'avgNet' | 'roi' | 'wins' | 'avgRank' | 'bestNight' | 'worstNight' | 'itmRate';

const COLUMNS: { key: SortKey; label: string; hint?: string }[] = [
  { key: 'games', label: 'ערבים' },
  { key: 'net', label: 'מאזן כולל' },
  { key: 'avgNet', label: 'ממוצע לערב' },
  { key: 'roi', label: 'ROI' },
  { key: 'wins', label: 'ניצחונות' },
  { key: 'avgRank', label: 'מקום ממוצע' },
  { key: 'itmRate', label: '% ערבים ברווח' },
  { key: 'bestNight', label: 'הכי טוב' },
  { key: 'worstNight', label: 'הכי גרוע' },
];

export function Leaderboard() {
  const { players, games } = useStore();
  const stats = useMemo(() => computeStats(games, players), [games, players]);
  const [sortKey, setSortKey] = useState<SortKey>('net');
  const [asc, setAsc] = useState(false);
  const [selected, setSelected] = useState<PlayerStats | null>(null);

  const rows = useMemo(() => {
    const active = stats.ordered.filter((s) => s.games > 0);
    const sorted = [...active].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      const diff = (va as number) - (vb as number);
      return asc ? diff : -diff;
    });
    return sorted;
  }, [stats, sortKey, asc]);

  const click = (key: SortKey) => {
    if (key === sortKey) setAsc((a) => !a);
    else {
      setSortKey(key);
      setAsc(key === 'avgRank' || key === 'worstNight');
    }
  };

  if (rows.length === 0) {
    return <Empty icon="📊" title="אין עדיין נתונים" text="אחרי הערב הראשון הטבלה הזאת תתמלא מעצמה." />;
  }

  return (
    <div className="fade-in">
      <div className="section-head">
        <div>
          <h1>לוח מובילים</h1>
          <p>המאזן הכולל של כל שחקן מאז תחילת המעקב. לחיצה על שחקן פותחת כרטיס מלא.</p>
        </div>
      </div>

      <div className="card">
        {rows.map((s, i) => (
          <div className={`lb-row${i === 0 ? ' top' : ''}`} key={s.player.id} onClick={() => setSelected(s)}>
            <div className={`rank-pill r${i + 1}`}>{i + 1}</div>
            <div className="lb-main">
              <Avatar player={s.player} />
              <div style={{ minWidth: 0 }}>
                <div className="lb-name">
                  {s.player.name}
                  {s.currentStreak >= 2 && <span title={`${s.currentStreak} ניצחונות ברצף`}> 🔥</span>}
                  {s.currentStreak <= -2 && <span title={`${-s.currentStreak} הפסדים ברצף`}> 🧊</span>}
                </div>
                <div className="lb-sub">
                  {s.games} ערבים · {s.wins} ניצחונות · ממוצע {signedMoney(s.avgNet)}
                </div>
              </div>
            </div>
            <div className={`lb-net ${s.net > 0 ? 'pos' : s.net < 0 ? 'neg' : 'muted'}`}>
              {signedMoney(s.net)}
              <div className="lb-sub">ROI {(s.roi * 100).toFixed(0)}%</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">
          <h2>טבלה מלאה</h2>
          <span className="hint">לחצו על כותרת כדי למיין</span>
        </div>
        <div className="table-wrap">
          <table className="tbl" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th>שחקן</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} style={{ cursor: 'pointer', color: sortKey === c.key ? 'var(--gold)' : undefined }} onClick={() => click(c.key)}>
                    {c.label} {sortKey === c.key ? (asc ? '▲' : '▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.player.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(s)}>
                  <td className="name-cell">
                    <div className="player-cell">
                      <Avatar player={s.player} size="sm" /> {s.player.name}
                    </div>
                  </td>
                  <td className="num">{s.games}</td>
                  <td className={`num ${s.net > 0 ? 'pos' : s.net < 0 ? 'neg' : 'muted'}`} style={{ fontWeight: 800 }}>{signedMoney(s.net)}</td>
                  <td className={`num ${s.avgNet >= 0 ? 'pos' : 'neg'}`}>{signedMoney(s.avgNet)}</td>
                  <td className={`num ${s.roi >= 0 ? 'pos' : 'neg'}`}>{(s.roi * 100).toFixed(1)}%</td>
                  <td className="num">{s.wins}</td>
                  <td className="num">{s.avgRank.toFixed(1)}</td>
                  <td className="num">{Math.round(s.itmRate * 100)}%</td>
                  <td className="num pos">{money(s.bestNight)}</td>
                  <td className="num neg">{money(s.worstNight)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <PlayerModal stats={selected} summaries={stats.summaries} onClose={() => setSelected(null)} />}
    </div>
  );
}
