import { useState } from 'react';
import { useStore } from '../../state/store';
import { errorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';

/** מסך שמוצג כשאין למשתמש קלאב מאושר: יצירה, הצטרפות בקוד, והמתנה לאישור. */
export function ClubGate() {
  const { memberships, createClub, joinClub, refreshMemberships, leaveClub, profile } = useStore();
  const [name, setName] = useState('');
  const [buyIn, setBuyIn] = useState(100);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const pending = memberships.filter((m) => m.status === 'pending');
  const rejected = memberships.filter((m) => m.status === 'rejected');

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: 620, margin: '0 auto' }}>
      <div className="section-head">
        <div>
          <h1>היי {profile?.displayName} 👋</h1>
          <p>כדי להתחיל, פתחו קלאב חדש או הצטרפו לקלאב קיים עם הקוד שקיבלתם.</p>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="card">
          <div className="card-title">
            <h2>⏳ ממתין לאישור</h2>
            <button className="btn btn-sm btn-ghost" onClick={() => void run(refreshMemberships)}>רענון</button>
          </div>
          {pending.map((m) => (
            <div className="lb-row" key={m.clubId} style={{ cursor: 'default' }}>
              <span style={{ fontSize: 20 }}>🕐</span>
              <div className="lb-main">
                <div style={{ minWidth: 0 }}>
                  <div className="lb-name">{m.club.name}</div>
                  <div className="lb-sub">הבקשה נשלחה ב-{formatDate(m.requestedAt.slice(0, 10))} · האדמין צריך לאשר</div>
                </div>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => void run(() => leaveClub(m.clubId))}>ביטול</button>
            </div>
          ))}
        </div>
      )}

      {rejected.length > 0 && (
        <div className="card">
          <div className="card-title"><h2>🚫 בקשות שנדחו</h2></div>
          {rejected.map((m) => (
            <div className="lb-row" key={m.clubId} style={{ cursor: 'default' }}>
              <span style={{ fontSize: 20 }}>✕</span>
              <div className="lb-main">
                <div className="lb-name">{m.club.name}</div>
              </div>
              <span className="muted" style={{ fontSize: 12 }}>אפשר לבקש שוב עם הקוד</span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-title">
          <h2>🔑 הצטרפות לקלאב</h2>
          <span className="hint">קוד בן 6 תווים</span>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <input
            className="input code-input"
            style={{ flex: 1, minWidth: 160 }}
            value={code}
            maxLength={6}
            placeholder="ABC123"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && code.trim().length >= 4) {
                void run(async () => {
                  const res = await joinClub(code);
                  setCode('');
                  setNote(res.status === 'approved' ? `הצטרפת ל${res.club.name}!` : `הבקשה ל${res.club.name} נשלחה — ממתינה לאישור האדמין.`);
                });
              }
            }}
          />
          <button
            className="btn btn-primary"
            disabled={busy || code.trim().length < 4}
            onClick={() =>
              void run(async () => {
                const res = await joinClub(code);
                setCode('');
                setNote(res.status === 'approved' ? `הצטרפת ל${res.club.name}!` : `הבקשה ל${res.club.name} נשלחה — ממתינה לאישור האדמין.`);
              })
            }
          >
            שליחת בקשה
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>➕ פתיחת קלאב חדש</h2>
          <span className="hint">אתם תהיו האדמין</span>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>שם הקלאב</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="שולחן חמישי" />
          </div>
          <div className="field">
            <label>סכום כניסה ברירת מחדל (₪)</label>
            <input className="input num" type="number" min={0} step={5} value={buyIn} onChange={(e) => setBuyIn(Number(e.target.value) || 0)} />
          </div>
        </div>
        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: 14 }}
          disabled={busy || name.trim().length < 2}
          onClick={() => void run(async () => { await createClub(name.trim(), buyIn); })}
        >
          יצירת הקלאב
        </button>
      </div>

      {note && <div className="balance-banner ok">{note}</div>}
      {error && <div className="balance-banner bad">{error}</div>}
    </div>
  );
}
