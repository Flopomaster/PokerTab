import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import { clearLegacyData, newId, readLegacyData } from '../../lib/storage';
import { errorMessage } from '../../lib/api';
import type { GameEntry } from '../../types';

/**
 * העלאה חד-פעמית של הנתונים מהגרסה המקומית הישנה אל הקלאב הפעיל.
 * מוצג רק אם באמת נשארו נתונים כאלה בדפדפן.
 */
export function MigrateLocalCard({ onToast }: { onToast: (m: string) => void }) {
  const { club, profile, players, addPlayer, saveGame, reloadClubData } = useStore();
  const legacy = useMemo(() => readLegacyData(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!legacy || !club || done) return null;

  const upload = async () => {
    setBusy(true);
    setError(null);
    try {
      // ממפים כל שחקן ישן לשחקן בקלאב — לפי שם אם כבר קיים, אחרת יוצרים
      const idMap = new Map<string, string>();
      for (const old of legacy.players) {
        const existing = players.find((p) => p.name.trim() === old.name.trim());
        if (existing) {
          idMap.set(old.id, existing.id);
        } else {
          const created = await addPlayer(old.name, old.emoji, old.color);
          idMap.set(old.id, created.id);
        }
      }

      for (const game of legacy.games) {
        const entries: GameEntry[] = game.entries
          .filter((e) => idMap.has(e.playerId))
          .map((e) => ({
            playerId: idMap.get(e.playerId)!,
            buyIns: Number(e.buyIns) || 0,
            extraBuyIn: Number(e.extraBuyIn) || 0,
            cashOut: Number(e.cashOut) || 0,
          }));
        if (entries.length === 0) continue;

        await saveGame({
          id: newId(),
          clubId: club.id,
          date: game.date,
          title: game.title ?? '',
          location: game.location ?? '',
          notes: game.notes ?? '',
          buyInAmount: Number(game.buyInAmount) || 0,
          dealerId: profile?.id ?? null,
          status: 'closed',
          entries,
          paidTransfers: game.paidTransfers ?? [],
          createdAt: game.createdAt ?? new Date().toISOString(),
        });
      }

      clearLegacyData();
      await reloadClubData();
      setDone(true);
      onToast(`הועלו ${legacy.games.length} שולחנות לקלאב ✓`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ borderColor: 'rgba(240,180,41,0.4)' }}>
      <div className="card-title">
        <h2>📦 נתונים מהגרסה הישנה</h2>
        <span className="chip gold">{legacy.games.length} שולחנות</span>
      </div>
      <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
        מצאנו {legacy.games.length} שולחנות ו-{legacy.players.length} שחקנים ששמורים בדפדפן הזה מלפני המעבר לקלאבים.
        אפשר להעלות אותם ל<b>{club.name}</b> — שחקנים עם שם זהה יתמזגו לשחקן קיים.
      </p>
      {error && <div className="balance-banner bad" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="row">
        <button className="btn btn-primary" disabled={busy} onClick={() => void upload()}>
          {busy ? 'מעלה...' : `העלאה ל${club.name}`}
        </button>
        <button
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => {
            clearLegacyData();
            setDone(true);
          }}
        >
          מחיקה ללא העלאה
        </button>
      </div>
    </div>
  );
}
