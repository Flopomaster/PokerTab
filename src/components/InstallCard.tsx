import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
}

/** מסביר איך להוסיף את PokerTab למסך הבית, ומציע התקנה בלחיצה איפה שאפשר. */
export function InstallCard() {
  const [installed, setInstalled] = useState(isStandalone);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <div className="card">
        <div className="card-title"><h2>📱 האפליקציה מותקנת</h2></div>
        <p className="muted" style={{ fontSize: 13.5 }}>
          אתם מריצים את PokerTab ממסך הבית — בלי סרגל דפדפן, עם אייקון משלה.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">
        <h2>📱 הוספה למסך הבית</h2>
        <span className="hint">נפתח כמו אפליקציה רגילה</span>
      </div>

      {prompt ? (
        <>
          <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
            אפשר להתקין את PokerTab במכשיר בלחיצה אחת — היא תיפתח במסך מלא עם אייקון משלה.
          </p>
          <button
            className="btn btn-primary"
            onClick={async () => {
              await prompt.prompt();
              const choice = await prompt.userChoice;
              if (choice.outcome === 'accepted') setInstalled(true);
              setPrompt(null);
            }}
          >
            התקנה במכשיר
          </button>
        </>
      ) : isIOS() ? (
        <ol className="muted" style={{ fontSize: 13.5, lineHeight: 2, paddingInlineStart: 20, margin: 0 }}>
          <li>פותחים את PokerTab ב-Safari (לא בכרום).</li>
          <li>מקישים על כפתור השיתוף — הריבוע עם החץ למעלה.</li>
          <li>בוחרים <b>הוסף למסך הבית</b> ומאשרים.</li>
        </ol>
      ) : (
        <ol className="muted" style={{ fontSize: 13.5, lineHeight: 2, paddingInlineStart: 20, margin: 0 }}>
          <li>פותחים את תפריט הדפדפן (שלוש נקודות).</li>
          <li>בוחרים <b>התקן אפליקציה</b> או <b>הוסף למסך הבית</b>.</li>
          <li>מאשרים — האייקון יופיע במסך הבית.</li>
        </ol>
      )}
    </div>
  );
}
