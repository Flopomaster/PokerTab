import { useState } from 'react';
import { useStore } from '../../state/store';
import { errorMessage } from '../../lib/api';
import { Modal } from '../ui';

/** בורר קלאב בכותרת + הצטרפות/יצירה של קלאב נוסף. */
export function ClubSwitcher() {
  const { club, memberships, selectClub, createClub, joinClub, profile, signOut } = useStore();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<'join' | 'create' | null>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const approved = memberships.filter((m) => m.status === 'approved');
  const pending = memberships.filter((m) => m.status === 'pending');

  const run = async (fn: () => Promise<void>) => {
    setError(null);
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
    <>
      <button className="club-pill" onClick={() => setOpen(true)}>
        <span className="club-pill-name">{club?.name ?? 'ללא קלאב'}</span>
        <span className="club-pill-caret">▾</span>
      </button>

      {open && (
        <Modal title="הקלאבים שלי" onClose={() => { setOpen(false); setAdding(null); setNote(null); setError(null); }}>
          {approved.map((m) => (
            <button
              key={m.clubId}
              className={`club-row${m.clubId === club?.id ? ' on' : ''}`}
              onClick={() => { selectClub(m.clubId); setOpen(false); }}
            >
              <div>
                <div className="lb-name">{m.club.name}</div>
                <div className="lb-sub">{m.role === 'admin' ? 'אדמין' : 'חבר'} · קוד {m.club.joinCode}</div>
              </div>
              {m.clubId === club?.id && <span className="chip gold">פעיל</span>}
            </button>
          ))}

          {pending.map((m) => (
            <div className="club-row" key={m.clubId} style={{ opacity: 0.6, cursor: 'default' }}>
              <div>
                <div className="lb-name">{m.club.name}</div>
                <div className="lb-sub">ממתין לאישור האדמין</div>
              </div>
              <span className="chip">⏳</span>
            </div>
          ))}

          {adding === null && (
            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn btn-sm" onClick={() => { setAdding('join'); setValue(''); }}>+ הצטרפות בקוד</button>
              <button className="btn btn-sm" onClick={() => { setAdding('create'); setValue(''); }}>+ קלאב חדש</button>
            </div>
          )}

          {adding === 'join' && (
            <div className="row" style={{ marginTop: 14, gap: 8 }}>
              <input
                className="input code-input"
                style={{ flex: 1 }}
                maxLength={6}
                placeholder="ABC123"
                value={value}
                onChange={(e) => setValue(e.target.value.toUpperCase())}
              />
              <button
                className="btn btn-primary"
                disabled={busy || value.trim().length < 4}
                onClick={() =>
                  void run(async () => {
                    const res = await joinClub(value);
                    setAdding(null);
                    setNote(res.status === 'approved' ? `הצטרפת ל${res.club.name}` : `הבקשה ל${res.club.name} ממתינה לאישור`);
                  })
                }
              >
                שליחה
              </button>
            </div>
          )}

          {adding === 'create' && (
            <div className="row" style={{ marginTop: 14, gap: 8 }}>
              <input className="input" style={{ flex: 1 }} placeholder="שם הקלאב" value={value} onChange={(e) => setValue(e.target.value)} />
              <button
                className="btn btn-primary"
                disabled={busy || value.trim().length < 2}
                onClick={() => void run(async () => { await createClub(value.trim(), 100); setAdding(null); setOpen(false); })}
              >
                יצירה
              </button>
            </div>
          )}

          {note && <div className="balance-banner ok" style={{ marginTop: 12 }}>{note}</div>}
          {error && <div className="balance-banner bad" style={{ marginTop: 12 }}>{error}</div>}

          <div className="row between" style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--line-soft)' }}>
            <span className="muted" style={{ fontSize: 13 }}>מחובר כ-{profile?.displayName} (<span dir="ltr">@{profile?.username}</span>)</span>
            <button className="btn btn-sm btn-ghost" onClick={() => void signOut()}>התנתקות</button>
          </div>
        </Modal>
      )}
    </>
  );
}
