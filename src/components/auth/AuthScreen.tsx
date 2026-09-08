import { useState } from 'react';
import { useStore } from '../../state/store';
import { errorMessage } from '../../lib/api';
import { isDemoMode } from '../../lib/apiClient';
import { AppIcon } from '../../icons/AppIcon';

type Mode = 'signin' | 'signup';

export function AuthScreen() {
  const { signIn, signUp } = useStore();
  const [mode, setMode] = useState<Mode>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(username, password);
      } else {
        await signUp({ username, password, displayName, email: email.trim() || undefined });
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const valid =
    username.trim().length >= 2 &&
    password.length >= 6 &&
    (mode === 'signin' || displayName.trim().length >= 1);

  return (
    <div className="auth-wrap">
      <div className="auth-card fade-in">
        <div className="auth-head">
          <div className="brand-mark" style={{ width: 64, height: 64, borderRadius: 18 }}>
            <AppIcon size={64} />
          </div>
          <div>
            <h1 className="brand-title" style={{ fontSize: 28 }}>PokerTab</h1>
            <p className="muted" style={{ fontSize: 13.5 }}>מי חייב למי, וכמה — לכל הקלאבים שלך</p>
          </div>
        </div>

        <div className="seg">
          <button className={`seg-btn${mode === 'signin' ? ' on' : ''}`} onClick={() => setMode('signin')}>כניסה</button>
          <button className={`seg-btn${mode === 'signup' ? ' on' : ''}`} onClick={() => setMode('signup')}>הרשמה</button>
        </div>

        <div className="field">
          <label>{mode === 'signin' ? 'שם משתמש (או מייל)' : 'שם משתמש'}</label>
          <input
            className="input"
            autoCapitalize="off"
            autoCorrect="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="yahel"
            onKeyDown={(e) => e.key === 'Enter' && valid && !busy && void submit()}
          />
        </div>

        {mode === 'signup' && (
          <div className="field" style={{ marginTop: 12 }}>
            <label>איך יקראו לך באפליקציה</label>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="יהל" />
          </div>
        )}

        <div className="field" style={{ marginTop: 12 }}>
          <label>סיסמה</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="לפחות 6 תווים"
            onKeyDown={(e) => e.key === 'Enter' && valid && !busy && void submit()}
          />
        </div>

        {mode === 'signup' && (
          <div className="field" style={{ marginTop: 12 }}>
            <label>מייל (לא חובה)</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="רק לשחזור סיסמה"
              autoCapitalize="off"
            />
            <span className="muted" style={{ fontSize: 11.5 }}>
              בלי מייל אין דרך לשחזר סיסמה שנשכחה — רק לפתוח חשבון חדש.
            </span>
          </div>
        )}

        {error && <div className="balance-banner bad" style={{ marginTop: 14 }}>{error}</div>}

        <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} disabled={!valid || busy} onClick={() => void submit()}>
          {busy ? 'רגע...' : mode === 'signin' ? 'כניסה' : 'יצירת חשבון'}
        </button>

        <p className="muted" style={{ fontSize: 12.5, marginTop: 14, textAlign: 'center' }}>
          {mode === 'signin' ? 'אין לך חשבון? ' : 'כבר יש לך חשבון? '}
          <button className="link-btn" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}>
            {mode === 'signin' ? 'הרשמה' : 'כניסה'}
          </button>
        </p>

        {isDemoMode && (
          <div className="demo-note">
            <b>מצב הדגמה</b> — עדיין לא חובר שרת, ולכן החשבונות והקלאבים נשמרים בדפדפן הזה בלבד
            ואינם משותפים עם אף אחד. אל תשמרו כאן נתונים אמיתיים.
          </div>
        )}
      </div>
    </div>
  );
}
