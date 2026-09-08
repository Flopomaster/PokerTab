import { useMemo, useState } from 'react';
import type { Game } from '../types';
import { useStore } from '../state/store';
import { computeTransfers, transferKey } from '../lib/settle';
import { errorMessage } from '../lib/api';
import { summarizeGame } from '../lib/stats';
import { formatDateLong, money, rankBadge, signedMoney } from '../lib/format';
import { Avatar, Modal } from './ui';

export function GameDetail({ game, onBack, onEdit, onToast }: { game: Game; onBack: () => void; onEdit: () => void; onToast: (m: string) => void }) {
  const { players, deleteGame, canEditGame, canActForPlayer, settlementFor, markTransferSent, confirmTransferReceived, members } = useStore();
  const [actionError, setActionError] = useState<string | null>(null);
  const canEdit = canEditGame(game);
  const dealer = members.find((m) => m.userId === game.dealerId)?.profile;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const summary = useMemo(() => summarizeGame(game), [game]);
  const transfers = useMemo(
    () => computeTransfers(summary.results.map((r) => ({ id: r.playerId, net: r.net }))),
    [summary],
  );

  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? '—';
  const playerOf = (id: string) => players.find((p) => p.id === id);

  const shareText = useMemo(() => {
    const lines: string[] = [];
    lines.push(`🃏 שולחן פוקר — ${formatDateLong(game.date)}`);
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
  }, [game, summary, transfers, players]);

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

  const doneCount = transfers.filter((t) => settlementFor(game.id, t.from, t.to)?.receiverConfirmed).length;

  const act = async (fn: () => Promise<void>) => {
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  };

  return (
    <div className="fade-in">
      <div className="section-head">
        <div>
          <button className="btn btn-sm btn-ghost" style={{ marginBottom: 8 }} onClick={onBack}>→ חזרה</button>
          <h1>{game.title || 'שולחן פוקר'}</h1>
          <p>
            {formatDateLong(game.date)}
            {game.location ? ` · ${game.location}` : ''} · כניסה {money(game.buyInAmount)}
            {dealer ? ` · 🎩 הדילר: ${dealer.displayName}` : ''}
          </p>
        </div>
        {canEdit && (
          <div className="row">
            <button className="btn btn-sm" onClick={onEdit}>✎ עריכה</button>
            <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(true)}>מחיקה</button>
          </div>
        )}
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
          <span className="hint">{transfers.length} העברות · {doneCount} אושרו</span>
        </div>

        <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
          כל אחד מסמן על עצמו שהעביר, והמקבל מאשר שהכסף הגיע. חוב שלא אושר יקפוץ כאזהרה בשולחן הבא.
        </p>

        {actionError && <div className="balance-banner bad" style={{ marginBottom: 12 }}>{actionError}</div>}

        {!canEdit && (
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
            את הסכומים עצמם יכולים לערוך רק הדילר של השולחן ואדמין הקלאב.
          </p>
        )}

        {transfers.length === 0 ? (
          <p className="muted" style={{ fontSize: 14 }}>אין העברות — כולם יצאו מאוזנים 🤝</p>
        ) : (
          transfers.map((t) => {
            const key = transferKey(t);
            const state = settlementFor(game.id, t.from, t.to);
            const sent = !!state?.senderMarked;
            const confirmed = !!state?.receiverConfirmed;
            const iAmPayer = canActForPlayer(game, t.from);
            const iAmReceiver = canActForPlayer(game, t.to);

            return (
              <div className={`transfer${confirmed ? ' paid' : ''}`} key={key} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                <div className="row between" style={{ gap: 10 }}>
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

                <div className="row between" style={{ gap: 8 }}>
                  <span className={`chip ${confirmed ? 'pos' : sent ? 'gold' : ''}`}>
                    {confirmed ? '✓ הועבר ואושר' : sent ? `⏳ ממתין לאישור ${nameOf(t.to)}` : 'טרם הועבר'}
                  </span>

                  <div className="row" style={{ gap: 6 }}>
                    {iAmPayer && !confirmed && (
                      <button
                        className={`btn btn-sm${sent ? '' : ' btn-primary'}`}
                        onClick={() => void act(() => markTransferSent(game.id, t.from, t.to, !sent))}
                      >
                        {sent ? 'ביטול הסימון' : 'העברתי'}
                      </button>
                    )}
                    {iAmReceiver && (
                      <button
                        className={`btn btn-sm${confirmed ? '' : ' btn-primary'}`}
                        onClick={() => void act(() => confirmTransferReceived(game.id, t.from, t.to, !confirmed))}
                      >
                        {confirmed ? 'ביטול האישור' : 'קיבלתי ✓'}
                      </button>
                    )}
                  </div>
                </div>
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
          <h2>🏁 תוצאות השולחן</h2>
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
        <Modal title="למחוק את השולחן?" onClose={() => setConfirmDelete(false)}>
          <p className="muted" style={{ fontSize: 14, marginBottom: 18 }}>
            השולחן מ־{formatDateLong(game.date)} יימחק לצמיתות, וכל הסטטיסטיקות יחושבו מחדש בלעדיו.
          </p>
          <div className="row">
            <button
              className="btn btn-danger"
              onClick={() => {
                void deleteGame(game.id).then(onBack);
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
