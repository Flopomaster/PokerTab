import { useRef, useState } from 'react';
import { useStore } from '../state/store';
import { exportToFile } from '../lib/storage';
import { buildDemoData } from '../lib/demo';
import { Modal } from './ui';
import { InstallCard } from './InstallCard';

export function SettingsPage({ onToast }: { onToast: (m: string) => void }) {
  const { data, updateSettings, replaceAll, resetAll } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDemo, setConfirmDemo] = useState(false);

  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        replaceAll(parsed);
        onToast('הנתונים יובאו בהצלחה ✓');
      } catch {
        onToast('הקובץ לא תקין ✗');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fade-in">
      <div className="section-head">
        <div>
          <h1>הגדרות</h1>
          <p>הנתונים נשמרים בדפדפן הזה בלבד. גיבוי ושיתוף נעשים דרך קובץ JSON.</p>
        </div>
      </div>

      <InstallCard />

      <div className="card">
        <div className="card-title"><h2>⚙️ כללי</h2></div>
        <div className="grid-2">
          <div className="field">
            <label>שם הקבוצה</label>
            <input className="input" value={data.settings.groupName} onChange={(e) => updateSettings({ groupName: e.target.value })} />
          </div>
          <div className="field">
            <label>סכום כניסה ברירת מחדל (₪)</label>
            <input
              className="input num"
              type="number"
              min={0}
              step={5}
              value={data.settings.defaultBuyIn}
              onChange={(e) => updateSettings({ defaultBuyIn: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>💾 גיבוי ושיתוף</h2>
          <span className="hint">{data.games.length} ערבים · {data.players.length} שחקנים</span>
        </div>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
          מייצאים קובץ, שולחים לחבר, והוא מייבא אותו אצלו — ככה כולם רואים את אותם נתונים.
        </p>
        <div className="row">
          <button className="btn btn-primary" onClick={() => exportToFile(data)}>⬇ ייצוא לקובץ</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>⬆ ייבוא מקובץ</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importFile(f);
              e.target.value = '';
            }}
          />
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>שימו לב: ייבוא מחליף את כל הנתונים הקיימים בדפדפן הזה.</p>
      </div>

      <div className="card">
        <div className="card-title"><h2>🧪 נתוני דמו</h2></div>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
          רוצים לראות איך הכל נראה מלא? אפשר לטעון 10 ערבים לדוגמה. זה ידרוס את הנתונים הנוכחיים.
        </p>
        <button className="btn" onClick={() => setConfirmDemo(true)}>טעינת נתוני דמו</button>
      </div>

      <div className="card">
        <div className="card-title"><h2>🗑️ איפוס</h2></div>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>מחיקת כל השחקנים והערבים מהדפדפן הזה. אין דרך חזרה — כדאי לייצא קודם.</p>
        <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>מחיקת כל הנתונים</button>
      </div>

      {confirmReset && (
        <Modal title="למחוק הכל?" onClose={() => setConfirmReset(false)}>
          <p className="muted" style={{ fontSize: 14, marginBottom: 18 }}>
            כל {data.games.length} הערבים ו־{data.players.length} השחקנים יימחקו לצמיתות מהדפדפן הזה.
          </p>
          <div className="row">
            <button
              className="btn btn-danger"
              onClick={() => {
                resetAll();
                setConfirmReset(false);
                onToast('הכל נמחק');
              }}
            >
              כן, למחוק הכל
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>ביטול</button>
          </div>
        </Modal>
      )}

      {confirmDemo && (
        <Modal title="לטעון נתוני דמו?" onClose={() => setConfirmDemo(false)}>
          <p className="muted" style={{ fontSize: 14, marginBottom: 18 }}>הנתונים הקיימים יוחלפו ב־10 ערבים לדוגמה עם 6 שחקנים.</p>
          <div className="row">
            <button
              className="btn btn-primary"
              onClick={() => {
                replaceAll(buildDemoData());
                setConfirmDemo(false);
                onToast('נתוני דמו נטענו ✓');
              }}
            >
              כן, לטעון
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirmDemo(false)}>ביטול</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
