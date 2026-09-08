import { useEffect, useMemo, useRef, useState } from 'react';
import type { Game, GameEntry } from '../types';
import { useStore } from '../state/store';
import { entryBuyIn } from '../lib/stats';
import { errorMessage } from '../lib/api';
import { formatDate, money, round2, signedMoney } from '../lib/format';
import { Avatar, Modal, Stepper } from './ui';

type Phase = 'playing' | 'closing';

/** ניהול ערב תוך כדי שהוא מתנהל: כניסות, שחקנים שמצטרפים, וסגירה בסוף. */
export function LiveGame({ game, onClose, onToast }: { game: Game; onClose: (gameId: string) => void; onToast: (m: string) => void }) {
  const { players, activePlayers, addPlayer, saveGame, deleteGame, canEditGame, members } = useStore();
  const canEdit = canEditGame(game);

  const [entries, setEntries] = useState<GameEntry[]>(game.entries);
  const [phase, setPhase] = useState<Phase>('playing');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(entries);
  latest.current = entries;

  /* עדכון חי מהשרת — רק כשאנחנו לא באמצע עריכה מקומית */
  useEffect(() => {
    if (!dirty.current) setEntries(game.entries);
  }, [game]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const persist = async (next: GameEntry[], status: Game['status'] = game.status) => {
    setSaving(true);
    setError(null);
    try {
      await saveGame({ ...game, entries: next, status });
      dirty.current = false;
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  /* שמירה מושהית: לחיצות רצופות על + לא שולחות בקשה לכל לחיצה */
  const schedule = (next: GameEntry[]) => {
    dirty.current = true;
    setEntries(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(next), 700);
  };

  /* שמירה מיידית ביציאה מהמסך, כדי שלא ייעלמו שינויים */
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (dirty.current) void saveGame({ ...game, entries: latest.current });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = (playerId: string, p: Partial<GameEntry>) =>
    schedule(entries.map((e) => (e.playerId === playerId ? { ...e, ...p } : e)));

  const seat = (playerId: string) =>
    schedule([...entries, { playerId, buyIns: 1, extraBuyIn: 0, cashOut: 0 }]);

  const unseat = (playerId: string) => schedule(entries.filter((e) => e.playerId !== playerId));

  const addGuest = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const player = await addPlayer(name);
      seat(player.id);
      setNewName('');
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const totals = useMemo(() => {
    const buyIn = round2(entries.reduce((s, e) => s + entryBuyIn(e, game.buyInAmount), 0));
    const cashOut = round2(entries.reduce((s, e) => s + e.cashOut, 0));
    return { buyIn, cashOut, diff: round2(cashOut - buyIn) };
  }, [entries, game.buyInAmount]);

  const balanced = Math.abs(totals.diff) < 0.005;
  const seated = new Set(entries.map((e) => e.playerId));
  const bench = activePlayers.filter((p) => !seated.has(p.id));
  const dealer = members.find((m) => m.userId === game.dealerId)?.profile;

  const elapsed = useMemo(() => {
    const minutes = Math.max(0, Math.floor((now - new Date(game.createdAt).getTime()) / 60000));
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h} שע׳ ${m} דק׳` : `${m} דק׳`;
  }, [now, game.createdAt]);

  const closeNight = async () => {
    if (timer.current) clearTimeout(timer.current);
    await persist(entries, 'closed');
    onToast('הערב נסגר — הנה ההעברות ✓');
    onClose(game.id);
  };

  return (
    <div className="fade-in">
      <div className="section-head">
        <div>
          <div className="live-badge"><span className="live-dot" /> ערב פעיל</div>
          <h1 style={{ marginTop: 6 }}>{game.title || 'ערב פוקר'}</h1>
          <p>
            {formatDate(game.date)}
            {game.location ? ` · ${game.location}` : ''} · רץ כבר {elapsed}
            {dealer ? ` · 🎩 ${dealer.displayName}` : ''}
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="muted" style={{ fontSize: 12 }}>{saving ? 'שומר...' : dirty.current ? '' : 'נשמר ✓'}</span>
        </div>
      </div>

      {!canEdit && (
        <div className="balance-banner ok" style={{ marginBottom: 14 }}>
          <span>👀</span>
          <span>הערב מתנהל עכשיו. רק {dealer?.displayName ?? 'הדילר'} או אדמין הקלאב יכולים לעדכן אותו.</span>
        </div>
      )}

      {error && <div className="balance-banner bad" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <div className="stat">
          <div className="label">בקופה עכשיו</div>
          <div className="value" style={{ color: 'var(--gold)' }}>{money(totals.buyIn)}</div>
          <div className="sub">{entries.length} שחקנים · כניסה {money(game.buyInAmount)}</div>
        </div>
        <div className="stat">
          <div className="label">סה״כ כניסות</div>
          <div className="value">{entries.reduce((s, e) => s + e.buyIns, 0)}</div>
          <div className="sub">ממוצע {(entries.length ? entries.reduce((s, e) => s + e.buyIns, 0) / entries.length : 0).toFixed(1)} לשחקן</div>
        </div>
        {phase === 'closing' && (
          <div className="stat">
            <div className="label">חולק עד עכשיו</div>
            <div className="value" style={{ color: balanced ? 'var(--green)' : 'var(--red)' }}>{money(totals.cashOut)}</div>
            <div className="sub">{balanced ? 'מאוזן' : `נשאר ${money(Math.abs(totals.diff))}`}</div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <h2>{phase === 'playing' ? '🎲 על השולחן' : '💰 כמה כל אחד יצא עם'}</h2>
          {phase === 'playing' && <span className="hint">כל שינוי נשמר לבד</span>}
        </div>

        {entries.length === 0 && <p className="muted" style={{ fontSize: 13.5 }}>עוד לא ישב אף אחד לשולחן.</p>}

        {entries.map((e) => {
          const player = players.find((p) => p.id === e.playerId);
          const spent = entryBuyIn(e, game.buyInAmount);
          const net = round2(e.cashOut - spent);
          return (
            <div className="live-row" key={e.playerId}>
              <div className="live-who">
                <Avatar player={player} />
                <div style={{ minWidth: 0 }}>
                  <div className="lb-name">{player?.name ?? '—'}</div>
                  <div className="lb-sub">
                    {phase === 'playing'
                      ? `נכנס ב-${money(spent)}`
                      : `${money(spent)} כניסות · ${net >= 0 ? 'ברווח' : 'בהפסד'} ${signedMoney(net)}`}
                  </div>
                </div>
              </div>

              {phase === 'playing' ? (
                <div className="live-controls">
                  <Stepper value={e.buyIns} min={0} onChange={(v) => canEdit && patch(e.playerId, { buyIns: v })} />
                  {canEdit && (
                    <button className="btn btn-sm btn-ghost" onClick={() => unseat(e.playerId)} title="הסרה מהשולחן">✕</button>
                  )}
                </div>
              ) : (
                <div className="live-controls">
                  <input
                    className="input num"
                    style={{ width: 110, textAlign: 'center' }}
                    type="number"
                    step={5}
                    inputMode="decimal"
                    placeholder="0"
                    value={e.cashOut || ''}
                    disabled={!canEdit}
                    onChange={(ev) => patch(e.playerId, { cashOut: Number(ev.target.value) || 0 })}
                  />
                  {canEdit && (
                    <button
                      className="btn btn-sm"
                      title="השלמת ההפרש על השחקן הזה"
                      onClick={() => patch(e.playerId, { cashOut: round2(e.cashOut - totals.diff) })}
                    >
                      איזון
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {phase === 'playing' && canEdit && (
          <>
            <div className="row" style={{ marginTop: 14, gap: 8 }}>
              {bench.map((p) => (
                <button key={p.id} className="chip" style={{ cursor: 'pointer' }} onClick={() => seat(p.id)}>
                  <span>{p.emoji}</span> {p.name} <span className="muted">+</span>
                </button>
              ))}
            </div>
            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              <input
                className="input"
                style={{ maxWidth: 220 }}
                placeholder="מצטרף חדש..."
                value={newName}
                onChange={(ev) => setNewName(ev.target.value)}
                onKeyDown={(ev) => ev.key === 'Enter' && void addGuest()}
              />
              <button className="btn btn-sm" onClick={() => void addGuest()} disabled={!newName.trim()}>הושבה לשולחן</button>
            </div>
          </>
        )}
      </div>

      {phase === 'closing' && (
        <div className={`balance-banner ${balanced ? 'ok' : 'bad'}`} style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 18 }}>{balanced ? '✓' : '⚠️'}</span>
          {balanced ? (
            <span>הקופה מאוזנת — אפשר לסגור את הערב.</span>
          ) : (
            <span>
              {totals.diff < 0 ? 'חסרים' : 'עודפים'} {money(Math.abs(totals.diff))} — בדקו את הספירה או השלימו על שחקן בכפתור "איזון".
            </span>
          )}
        </div>
      )}

      {canEdit && (
        <div className="card">
          {phase === 'playing' ? (
            <>
              <button className="btn btn-primary btn-block" disabled={entries.length < 2} onClick={() => setPhase('closing')}>
                סיום הערב וחלוקה →
              </button>
              {entries.length < 2 && (
                <p className="muted" style={{ fontSize: 12.5, marginTop: 8, textAlign: 'center' }}>צריך לפחות שני שחקנים.</p>
              )}
              <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={() => setConfirmCancel(true)}>
                ביטול הערב
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-primary btn-block" disabled={saving} onClick={() => void closeNight()}>
                {saving ? 'סוגר...' : 'סגירת הערב וחישוב ההעברות'}
              </button>
              <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={() => setPhase('playing')}>
                ← חזרה לניהול הערב
              </button>
            </>
          )}
        </div>
      )}

      {confirmCancel && (
        <Modal title="לבטל את הערב?" onClose={() => setConfirmCancel(false)}>
          <p className="muted" style={{ fontSize: 14, marginBottom: 18 }}>
            הערב יימחק לגמרי, על כל הכניסות שנרשמו בו. אין דרך חזרה.
          </p>
          <div className="row">
            <button
              className="btn btn-danger"
              onClick={() => {
                dirty.current = false;
                void deleteGame(game.id).then(() => onToast('הערב בוטל'));
                setConfirmCancel(false);
                onClose('');
              }}
            >
              כן, לבטל
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirmCancel(false)}>חזרה</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
