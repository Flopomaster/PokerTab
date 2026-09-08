import { useState } from 'react';
import { useStore } from '../state/store';
import { exportJson, PLAYER_COLORS, PLAYER_EMOJIS } from '../lib/storage';
import { errorMessage } from '../lib/api';
import { isDemoMode } from '../lib/apiClient';
import { Avatar } from './ui';
import { InstallCard } from './InstallCard';
import { MigrateLocalCard } from './clubs/MigrateLocalCard';

export function SettingsPage({ onToast }: { onToast: (m: string) => void }) {
  const { profile, club, players, games, updateProfile, signOut } = useStore();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [emoji, setEmoji] = useState(profile?.emoji ?? '🃏');
  const [color, setColor] = useState(profile?.color ?? PLAYER_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = displayName !== profile?.displayName || emoji !== profile?.emoji || color !== profile?.color;

  const saveProfile = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateProfile({ displayName: displayName.trim() || profile!.displayName, emoji, color });
      onToast('הפרופיל עודכן ✓');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="section-head">
        <div>
          <h1>הגדרות</h1>
          <p>הפרופיל שלך, ההתקנה במכשיר וגיבוי הנתונים.</p>
        </div>
      </div>

      <MigrateLocalCard onToast={onToast} />

      <div className="card">
        <div className="card-title">
          <h2>🙋 הפרופיל שלי</h2>
          <span className="hint" dir="ltr">@{profile?.username}</span>
        </div>
        <div className="row" style={{ gap: 12, marginBottom: 14 }}>
          <Avatar player={{ emoji, color, name: displayName }} size="lg" />
          <div className="field" style={{ flex: 1 }}>
            <label>שם תצוגה</label>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
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

        {error && <div className="balance-banner bad" style={{ marginBottom: 12 }}>{error}</div>}
        <button className="btn btn-primary" disabled={!dirty || busy} onClick={() => void saveProfile()}>שמירת הפרופיל</button>
      </div>

      <InstallCard />

      <div className="card">
        <div className="card-title">
          <h2>💾 גיבוי</h2>
          <span className="hint">{games.length} שולחנות · {players.length} שחקנים</span>
        </div>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
          הורדת עותק של כל נתוני {club?.name ?? 'הקלאב'} כקובץ JSON, לשמירה אצלכם.
        </p>
        <button
          className="btn"
          disabled={!club}
          onClick={() => {
            exportJson({ club, players, games }, `pokertab-${club?.name ?? 'club'}-${new Date().toISOString().slice(0, 10)}.json`);
            onToast('הגיבוי ירד ✓');
          }}
        >
          ⬇ ייצוא לקובץ
        </button>
      </div>

      <div className="card">
        <div className="card-title"><h2>🚪 חשבון</h2></div>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
          מחובר כ-{profile?.displayName} (<span dir="ltr">@{profile?.username}</span>). הנתונים נשמרים בחשבון, אז אפשר להתחבר מכל מכשיר.
        </p>
        <button className="btn btn-danger" onClick={() => void signOut()}>התנתקות</button>
      </div>

      {isDemoMode && (
        <div className="card" style={{ borderColor: 'rgba(255,107,107,0.35)' }}>
          <div className="card-title"><h2>⚠️ מצב הדגמה</h2></div>
          <p className="muted" style={{ fontSize: 13.5 }}>
            לא הוגדר חיבור לשרת, ולכן כל החשבונות והקלאבים חיים בדפדפן הזה בלבד — אף אחד אחר לא רואה אותם.
            אחרי חיבור Supabase (ראו README) הכל יעבוד בין מכשירים.
          </p>
        </div>
      )}
    </div>
  );
}
