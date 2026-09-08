import { useMemo, useState } from 'react';
import type { Player } from '../types';
import { useStore } from '../state/store';
import { computeStats } from '../lib/stats';
import { PLAYER_COLORS, PLAYER_EMOJIS } from '../lib/storage';
import { formatDate, signedMoney } from '../lib/format';
import { Avatar, Empty, Modal } from './ui';

export function PlayersPage() {
  const { players, games, addPlayer, updatePlayer, deletePlayer, isAdmin } = useStore();
  const stats = useMemo(() => computeStats(games, players), [games, players]);
  const [editing, setEditing] = useState<Player | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const add = () => {
    const n = name.trim();
    if (!n) return;
    addPlayer(n);
    setName('');
    setCreating(false);
  };

  return (
    <div className="fade-in">
      <div className="section-head">
        <div>
          <h1>שחקנים</h1>
          <p>
            {players.length} שחקנים בקלאב.{' '}
            {isAdmin ? 'לחיצה על שחקן פותחת עריכה.' : 'רק אדמין הקלאב יכול לערוך שחקנים.'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ שחקן חדש</button>
      </div>

      {players.length === 0 ? (
        <Empty
          icon="👥"
          title="אין עדיין שחקנים"
          text="הוסיפו את החבורה — אפשר גם להוסיף שחקנים תוך כדי יצירת ערב."
          action={<button className="btn btn-primary" onClick={() => setCreating(true)}>+ שחקן חדש</button>}
        />
      ) : (
        <div className="card">
          {players.map((p) => {
            const s = stats.byPlayer.get(p.id);
            return (
              <div className="lb-row" key={p.id} onClick={() => isAdmin && setEditing(p)} style={{ cursor: isAdmin ? 'pointer' : 'default' }}>
                <Avatar player={p} />
                <div className="lb-main">
                  <div style={{ minWidth: 0 }}>
                    <div className="lb-name">{p.name}{p.archived ? ' (בארכיון)' : ''}</div>
                    <div className="lb-sub">
                      {s && s.games > 0 ? `${s.games} ערבים · אחרון ${formatDate(s.lastPlayed!)}` : 'עוד לא שיחק'}
                      {p.userId ? ' · חבר קלאב' : ' · אורח'}
                    </div>
                  </div>
                </div>
                <div className={`lb-net ${s && s.net > 0 ? 'pos' : s && s.net < 0 ? 'neg' : 'muted'}`}>
                  {s ? signedMoney(s.net) : '—'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating && (
        <Modal title="שחקן חדש" onClose={() => setCreating(false)}>
          <div className="field">
            <label>שם</label>
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="איך קוראים לו?" />
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={add} disabled={!name.trim()}>הוספה</button>
            <button className="btn btn-ghost" onClick={() => setCreating(false)}>ביטול</button>
          </div>
        </Modal>
      )}

      {editing && (
        <EditPlayerModal
          player={editing}
          gamesPlayed={stats.byPlayer.get(editing.id)?.games ?? 0}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            void updatePlayer(editing.id, patch);
            setEditing(null);
          }}
          onDelete={() => {
            void deletePlayer(editing.id);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EditPlayerModal({
  player,
  gamesPlayed,
  onClose,
  onSave,
  onDelete,
}: {
  player: Player;
  gamesPlayed: number;
  onClose: () => void;
  onSave: (patch: Partial<Player>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(player.name);
  const [emoji, setEmoji] = useState(player.emoji);
  const [color, setColor] = useState(player.color);
  const [archived, setArchived] = useState(!!player.archived);
  const [confirm, setConfirm] = useState(false);

  return (
    <Modal title="עריכת שחקן" onClose={onClose}>
      <div className="row" style={{ gap: 12, marginBottom: 16 }}>
        <Avatar player={{ ...player, emoji, color }} size="lg" />
        <div className="field" style={{ flex: 1 }}>
          <label>שם</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>

      <div className="field" style={{ marginBottom: 14 }}>
        <label>אימוג׳י</label>
        <div className="emoji-picker">
          {PLAYER_EMOJIS.map((e) => (
            <button key={e} className={`emoji-opt${e === emoji ? ' sel' : ''}`} onClick={() => setEmoji(e)}>{e}</button>
          ))}
        </div>
      </div>

      <div className="field" style={{ marginBottom: 14 }}>
        <label>צבע</label>
        <div className="row" style={{ gap: 8 }}>
          {PLAYER_COLORS.map((c) => (
            <button key={c} className={`color-opt${c === color ? ' sel' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
          ))}
        </div>
      </div>

      <label className="row" style={{ gap: 8, fontSize: 13.5, cursor: 'pointer', marginBottom: 16 }}>
        <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
        בארכיון (לא מוצע יותר בערבים חדשים)
      </label>

      <div className="row">
        <button className="btn btn-primary" onClick={() => onSave({ name: name.trim() || player.name, emoji, color, archived })}>
          שמירה
        </button>
        <button className="btn btn-ghost" onClick={onClose}>ביטול</button>
        <div className="spacer" />
        <button className="btn btn-sm btn-danger" onClick={() => setConfirm(true)}>מחיקה</button>
      </div>

      {confirm && (
        <div className="balance-banner bad" style={{ marginTop: 14, flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
          <span>
            מחיקת {player.name} תסיר אותו גם מ־{gamesPlayed} ערבים שנרשמו, וההעברות ההיסטוריות ישתנו. להמשיך?
          </span>
          <div className="row">
            <button className="btn btn-sm btn-danger" onClick={onDelete}>כן, למחוק</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setConfirm(false)}>ביטול</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
