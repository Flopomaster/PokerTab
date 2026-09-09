import { useEffect, useState } from 'react';
import { disablePush, enablePush, isSubscribed, needsInstallFirst, pushState, pushSupported } from '../lib/push';
import { isDemoMode } from '../lib/apiClient';
import { errorMessage } from '../lib/api';

/** הפעלה וכיבוי של התראות פוש למכשיר הנוכחי. */
export function NotificationsCard({ onToast }: { onToast: (m: string) => void }) {
  const [state, setState] = useState(pushState);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void isSubscribed().then(setSubscribed);
  }, []);

  if (isDemoMode) return null;

  const supported = pushSupported();
  const mustInstall = supported && needsInstallFirst();

  const turnOn = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await enablePush();
      setState(result);
      setSubscribed(result === 'granted');
      if (result === 'granted') onToast('התראות הופעלו ✓');
      else if (result === 'denied') setError('ההרשאה נדחתה. אפשר לשנות בהגדרות הדפדפן.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      await disablePush();
      setSubscribed(false);
      onToast('התראות כובו');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title">
        <h2>🔔 התראות</h2>
        {subscribed && <span className="chip pos">פעיל במכשיר הזה</span>}
      </div>

      <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
        תקבלו התראה כשנפתח שולחן, כששולחן נסגר ואתם רואים כמה יצאתם, וכשמישהו מבקש להצטרף לקלאב (לאדמין בלבד).
      </p>

      {!supported && (
        <div className="balance-banner bad">
          <span>הדפדפן הזה לא תומך בהתראות. נסו מדפדפן אחר או מהאפליקציה במסך הבית.</span>
        </div>
      )}

      {mustInstall && (
        <div className="balance-banner bad" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
          <b>באייפון צריך קודם להוסיף למסך הבית</b>
          <span style={{ fontWeight: 500 }}>
            אפל מאפשרת התראות רק לאפליקציה שהותקנה. פתחו בספארי → כפתור השיתוף → "הוסף למסך הבית", ואז חזרו לכאן מתוך האפליקציה.
          </span>
        </div>
      )}

      {error && <div className="balance-banner bad" style={{ marginTop: 12 }}>{error}</div>}

      {supported && !mustInstall && (
        <div className="row" style={{ marginTop: 14 }}>
          {subscribed ? (
            <button className="btn" disabled={busy} onClick={() => void turnOff()}>כיבוי התראות</button>
          ) : (
            <button className="btn btn-primary" disabled={busy || state === 'denied'} onClick={() => void turnOn()}>
              {busy ? 'רגע...' : 'הפעלת התראות'}
            </button>
          )}
        </div>
      )}

      {state === 'denied' && !subscribed && (
        <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
          חסמתם התראות בעבר. צריך לאפשר אותן ידנית בהגדרות המכשיר עבור האתר הזה.
        </p>
      )}
    </div>
  );
}
