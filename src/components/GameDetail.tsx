import { useMemo, useState } from 'react';
import type { Game } from '../types';
import { useStore } from '../state/store';
import { computeTransfers, transferKey } from '../lib/settle';
import { summarizeGame } from '../lib/stats';
import { formatDateLong, money, rankBadge, signedMoney } from '../lib/format';
import { Avatar, Modal } from './ui';

export function GameDetail({ game, onBack, onEdit, onToast }: { game: Game; onBack: () => void; onEdit: () => void; onToast: (m: string) => void }) {
  const { data, deleteGame, toggleTransferPaid } = useStore();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const summary = useMemo(() => summarizeGame(game), [game]);
  const transfers = useMemo(
    () => computeTransfers(summary.results.map((r) => ({ id: r.playerId, net: r.net }))),
    [summary],
  );

  const nameOf = (id: string) => data.players.find((p) => p.id === id)?.name ?? '—';
  const playerOf = (id: string) => data.players.find((p) => p.id === id);

  const shareText = useMemo(() => {
    const lines: string[] = [];
    lines.push(`🃏 ערב פוקר — ${formatDateLong(game.date)}`);
    if (game.location) lines.push(`📍 ${game.location}`);
    lines.push(`💰 קופה: ${money(summary.totalBuyIn)} · כניסה: ${money(game.buyInAmount)}`);
    lines.push('');
    lines.push('*תוצאות:*');
    summary.results.forEach((r) => {
      lines.push(`${rankBadge(r.rank)} ${nameOf(r.playerId)} ${signedMoney(r.net)}`);
    });
    lines.push('');
    if (transfers.length === 0) lines.push('אין העברות — כולם מאוזנים 🤝');
    else {
      lines.push('*מי מעביר למי:*');
      transfers.forEach((t) => lines.push(`${nameOf(t.from)} ➡️ ${nameOf(t.to)}: ${money(t.amount)}`));
    }
    return lines.join('\n');
  }, [game, summary, transfers, data.players]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      onToast('הסיכום הועתק ✓');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = shareText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      onToast('הסיכום הועתק ✓');
    }
  };

  const paidCount = transfers.filter((t) => game.paidTransfers.includes(transferKey(t))).length;

  return (
    <div className="fade-in">
      <div className="section-head">
        <div>
          <button className="btn btn-sm btn-ghost" style={{ marginBottom: 8 }} onClick={onBack}>→ חזרה</button>
          <h1>{game.title || 'ערב פוקר'}</h1>
          <p>
            {formatDateLong(game.date)}
            {game.location ? ` · ${game.location}` : ''} · כניסה {money(game.buyInAmount)}
          </p>
        </div>
        <div className="row">
          <button className="btn btn-sm" onClick={onEdit}>✎ עריכה</button>
          <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(true)}>מחיקה</button>
        </div>
      </div>

      {!summary.balanced && (
        <div className="balance-banner bad" style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span>הקופה לא מאוזנת — הפרש של {money(Math.abs(summary.diff))}. ההעברות מחושבות לפי מה שהוזן.</span>
        </div>
      )}

      <div className="card">
        <div className="card-title">
          <h2>💸 מי מעביר למי</h2>
          <span className="hint">{transfers.length} העברות · {paidCount} שולמו</span>
        </div>

        {transfers.length === 0 ? (
          <p className="muted" style={{ fontSize: 14 }}>אין העברות — כולם יצאו מאוזנים 🤝</p>
        ) : (
          transfers.map((t) => {
            const key = transferKey(t);
            const paid = game.paidTransfers.includes(key);
            return (
              <div className={`transfer${paid ? ' paid' : ''}`} key={key}>
                <button className={`check${paid ? ' on' : ''}`} onClick={() => toggleTransferPaid(game.id, key)} title="סימון כשולם">
                  {paid ? '✓' : ''}
                </button>
                <div className="transfer-flow">
                  <span className="transfer-who">
                    <Avatar player={playerOf(t.from)} size="sm" /> {nameOf(t.from)}
                  </span>
                  <span className="transfer-arrow">←</span>
                  <span className="transfer-who">
                    <Avatar player={playerOf(t.to)} size="sm" /> {nameOf(t.to)}
                  </span>
                </div>
                <span className="transfer-amount">{money(t.amount)}</span>
              </div>
            );
          })
        )}

        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={copy}>📋 העתקת סיכום</button>
          <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
            שיתוף בוואטסאפ
          </a>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>🏁 תוצאות הערב</h2>
          <span className="hint">קופה: {money(summary.totalBuyIn)}</span>
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 44 }}>#</th>
                <th>שחקן</th>
                <th>נכנס</th>
                <th>יצא</th>
                <th>מאזן</th>
              </tr>
            </thead>
            <tbody>
              {summary.results.map((r) => {
                const p = playerOf(r.playerId);
                return (
                  <tr key={r.playerId}>
                    <td>
                      <div className={`rank-pill r${r.rank}`}>{r.rank}</div>
                    </td>
                    <td className="name-cell">
                      <div className="player-cell">
                        <Avatar player={p} size="sm" /> {p?.name ?? '—'}
                      </div>
                    </td>
                    <td className="num muted">{money(r.buyIn)}</td>
                    <td className="num">{money(r.cashOut)}</td>
                    <td className={`num ${r.net > 0 ? 'pos' : r.net < 0 ? 'neg' : 'muted'}`} style={{ fontWeight: 800 }}>
                      {signedMoney(r.net)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {game.notes && (
          <p className="muted" style={{ fontSize: 13, marginTop: 14, whiteSpace: 'pre-wrap' }}>📝 {game.notes}</p>
        )}
      </div>

      {confirmDelete && (
        <Modal title="למחוק את הערב?" onClose={() => setConfirmDelete(false)}>
          <p className="muted" style={{ fontSize: 14, marginBottom: 18 }}>
            הערב מ־{formatDateLong(game.date)} יימחק לצמיתות, וכל הסטטיסטיקות יחושבו מחדש בלעדיו.
          </p>
          <div className="row">
            <button
              className="btn btn-danger"
              onClick={() => {
                deleteGame(game.id);
                onBack();
              }}
            >
              כן, למחוק
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>ביטול</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
