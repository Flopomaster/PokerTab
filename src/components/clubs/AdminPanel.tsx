import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import { errorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { Avatar, Empty, Modal } from '../ui';
import type { Player } from '../../types';

/** ניהול הקלאב: בקשות הצטרפות, חברים, קוד, ושיוך שחקני אורח לחשבונות. */
export function AdminPanel({ onToast }: { onToast: (m: string) => void }) {
  const {
    club, members, players, isAdmin, profile, loadingClub, reloadClubData,
    decideMember, setMemberRole, removeMember, regenerateJoinCode, updateClub, updatePlayer, leaveClub,
  } = useStore();

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linking, setLinking] = useState<Player | null>(null);
  const [confirmCode, setConfirmCode] = useState(false);
  const [name, setName] = useState(club?.name ?? '');
  const [buyIn, setBuyIn] = useState(club?.defaultBuyIn ?? 100);

  const pending = useMemo(() => members.filter((m) => m.status === 'pending'), [members]);
  const approved = useMemo(() => members.filter((m) => m.status === 'approved'), [members]);
  const guests = useMemo(() => players.filter((p) => !p.userId), [players]);

  const run = async (fn: () => Promise<void>, message?: string) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
      if (message) onToast(message);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!club) return <Empty icon="🏛️" title="אין קלאב פעיל" text="בחרו קלאב או צרו אחד חדש." />;

  const shareText = `הצטרפו לקלאב "${club.name}" ב-PokerTab עם הקוד: ${club.joinCode}\n${window.location.origin}${window.location.pathname}`;

  return (
    <div className="fade-in">
      <div className="section-head">
        <div>
          <h1>ניהול הקלאב</h1>
          <p>{club.name} · {approved.length} חברים{pending.length > 0 ? ` · ${pending.length} ממתינים` : ''}</p>
        </div>
      </div>

      {error && <div className="balance-banner bad" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="card">
        <div className="card-title">
          <h2>🔑 קוד ההצטרפות</h2>
          <span className="hint">מי שמזין אותו נכנס לרשימת ההמתנה</span>
        </div>
        <div className="join-code">{club.joinCode}</div>
        <div className="row" style={{ marginTop: 14 }}>
          <button
            className="btn"
            onClick={() => {
              void navigator.clipboard?.writeText(club.joinCode).then(() => onToast('הקוד הועתק ✓')).catch(() => onToast('לא הצלחתי להעתיק'));
            }}
          >
            📋 העתקת הקוד
          </button>
          <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
            שיתוף בוואטסאפ
          </a>
          {isAdmin && (
            <button className="btn btn-sm btn-danger" onClick={() => setConfirmCode(true)}>החלפת קוד</button>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="card" style={pending.length > 0 ? { borderColor: 'rgba(240,180,41,0.45)' } : undefined}>
          <div className="card-title">
            <h2>⏳ בקשות הצטרפות</h2>
            <div className="row" style={{ gap: 8 }}>
              {pending.length > 0 && <span className="chip gold">{pending.length}</span>}
              <button className="btn btn-sm btn-ghost" disabled={loadingClub} onClick={() => void run(reloadClubData)}>
                {loadingClub ? 'מרענן...' : 'רענון'}
              </button>
            </div>
          </div>

          {pending.length === 0 && (
            <p className="muted" style={{ fontSize: 13.5 }}>
              אין כרגע בקשות ממתינות. כשמישהו יזין את הקוד {club.joinCode} הוא יופיע כאן לאישור.
            </p>
          )}

          {pending.map((m) => (
            <div className="lb-row" key={m.userId} style={{ cursor: 'default' }}>
              <Avatar player={m.profile} />
              <div className="lb-main">
                <div style={{ minWidth: 0 }}>
                  <div className="lb-name">{m.profile?.displayName ?? 'משתמש'}</div>
                  <div className="lb-sub"><span dir="ltr">@{m.profile?.username}</span> · ביקש ב-{formatDate(m.requestedAt.slice(0, 10))}</div>
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => void run(() => decideMember(m.userId, 'approved'), 'החבר אושר ✓')}>אישור</button>
                <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => void run(() => decideMember(m.userId, 'rejected'))}>דחייה</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-title">
          <h2>👥 חברי הקלאב</h2>
          <span className="hint">{approved.length} מאושרים</span>
        </div>
        {approved.map((m) => {
          const isMe = m.userId === profile?.id;
          return (
            <div className="lb-row" key={m.userId} style={{ cursor: 'default' }}>
              <Avatar player={m.profile} />
              <div className="lb-main">
                <div style={{ minWidth: 0 }}>
                  <div className="lb-name">
                    {m.profile?.displayName ?? 'משתמש'} {m.role === 'admin' && <span className="chip gold">אדמין</span>}
                    {isMe && <span className="muted" style={{ fontWeight: 500 }}> (אני)</span>}
                  </div>
                  <div className="lb-sub" dir="ltr" style={{ textAlign: 'start' }}>@{m.profile?.username}</div>
                </div>
              </div>
              {isAdmin && !isMe && (
                <div className="row" style={{ gap: 6 }}>
                  <button
                    className="btn btn-sm"
                    disabled={busy}
                    onClick={() => void run(() => setMemberRole(m.userId, m.role === 'admin' ? 'member' : 'admin'), m.role === 'admin' ? 'הורד מאדמין' : 'מונה לאדמין ✓')}
                  >
                    {m.role === 'admin' ? 'הורדה מאדמין' : 'מינוי לאדמין'}
                  </button>
                  <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => void run(() => removeMember(m.userId), 'החבר הוסר')}>הסרה</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {guests.length > 0 && (
        <div className="card">
          <div className="card-title">
            <h2>🎭 שחקני אורח</h2>
            <span className="hint">שחקנים בלי חשבון — אפשר לקשר אותם לחבר קלאב</span>
          </div>
          {guests.map((g) => (
            <div className="lb-row" key={g.id} style={{ cursor: 'default' }}>
              <Avatar player={g} />
              <div className="lb-main">
                <div className="lb-name">{g.name}</div>
                <div className="lb-sub">אורח</div>
              </div>
              {isAdmin && <button className="btn btn-sm" onClick={() => setLinking(g)}>קישור לחשבון</button>}
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <div className="card">
          <div className="card-title"><h2>⚙️ הגדרות הקלאב</h2></div>
          <div className="grid-2">
            <div className="field">
              <label>שם הקלאב</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label>סכום כניסה ברירת מחדל (₪)</label>
              <input className="input num" type="number" min={0} step={5} value={buyIn} onChange={(e) => setBuyIn(Number(e.target.value) || 0)} />
            </div>
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: 14 }}
            disabled={busy || (name === club.name && buyIn === club.defaultBuyIn)}
            onClick={() => void run(() => updateClub({ name: name.trim() || club.name, defaultBuyIn: buyIn }), 'ההגדרות נשמרו ✓')}
          >
            שמירה
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-title"><h2>🚪 יציאה מהקלאב</h2></div>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
          תפסיקו לראות את הערבים והסטטיסטיקות של הקלאב. הנתונים עצמם נשארים אצל שאר החברים, ואפשר לבקש להצטרף שוב עם הקוד.
        </p>
        <button className="btn btn-danger" disabled={busy} onClick={() => void run(() => leaveClub(club.id))}>יציאה מ{club.name}</button>
      </div>

      {confirmCode && (
        <Modal title="להחליף את קוד ההצטרפות?" onClose={() => setConfirmCode(false)}>
          <p className="muted" style={{ fontSize: 14, marginBottom: 18 }}>
            הקוד הנוכחי ({club.joinCode}) יפסיק לעבוד מיד. מי שכבר חבר בקלאב לא מושפע.
          </p>
          <div className="row">
            <button
              className="btn btn-danger"
              onClick={() => void run(async () => { await regenerateJoinCode(); setConfirmCode(false); }, 'נוצר קוד חדש ✓')}
            >
              כן, קוד חדש
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirmCode(false)}>ביטול</button>
          </div>
        </Modal>
      )}

      {linking && (
        <Modal title={`קישור ${linking.name} לחשבון`} onClose={() => setLinking(null)}>
          <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
            בחרו את חבר הקלאב שמאחורי השם הזה. כל ההיסטוריה של השחקן תעבור לחשבון שלו.
          </p>
          {approved
            .filter((m) => !players.some((p) => p.userId === m.userId))
            .map((m) => (
              <button
                key={m.userId}
                className="btn btn-block"
                style={{ marginBottom: 8, justifyContent: 'flex-start' }}
                onClick={() => void run(async () => { await updatePlayer(linking.id, { userId: m.userId }); setLinking(null); }, 'השחקן קושר ✓')}
              >
                {m.profile?.emoji} {m.profile?.displayName} <span className="muted" dir="ltr">@{m.profile?.username}</span>
              </button>
            ))}
          {approved.filter((m) => !players.some((p) => p.userId === m.userId)).length === 0 && (
            <p className="muted" style={{ fontSize: 13.5 }}>כל חברי הקלאב כבר מקושרים לשחקנים.</p>
          )}
        </Modal>
      )}
    </div>
  );
}
