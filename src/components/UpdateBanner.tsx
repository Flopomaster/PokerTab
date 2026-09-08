import { useCallback, useEffect, useState } from 'react';

const CHECK_INTERVAL = 15 * 60 * 1000;

/**
 * בודק מול version.json אם עלתה גרסה חדשה של האתר, ומציע לרענן.
 * בלי זה, אפליקציה שנשארת פתוחה במסך הבית ממשיכה להריץ קוד ישן.
 */
export function UpdateBanner() {
  const [newBuild, setNewBuild] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { build?: string };
      if (data.build && data.build !== __BUILD_ID__) setNewBuild(data.build);
    } catch {
      // אין רשת — בודקים שוב בפעם הבאה
    }
  }, []);

  useEffect(() => {
    void check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    const id = setInterval(() => void check(), CHECK_INTERVAL);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(id);
    };
  }, [check]);

  if (!newBuild) return null;

  return (
    <div className="update-bar">
      <span>✨ יצאה גרסה חדשה של PokerTab</span>
      <button
        className="btn btn-sm btn-primary"
        onClick={() => {
          // פרמטר בכתובת מבטיח שגם ה-HTML עצמו יימשך מחדש ולא מהמטמון
          const base = window.location.href.split('?')[0].split('#')[0];
          window.location.replace(`${base}?v=${encodeURIComponent(newBuild)}`);
        }}
      >
        רענון
      </button>
    </div>
  );
}
