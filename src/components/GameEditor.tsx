import { useMemo, useState } from 'react';
import type { Game, GameEntry } from '../types';
import { useStore } from '../state/store';
import { newId } from '../lib/storage';
import { entryBuyIn } from '../lib/stats';
import { money, round2, signedMoney, todayISO } from '../lib/format';
import { Avatar, Stepper } from './ui';
import { errorMessage } from '../lib/api';

function num(v: string): number {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function GameEditor({ game, onDone, onCancel }: { game: Game | null; onDone: (id: string) => void; onCancel: () => void }) {
  // ערב חדש נפתח כ"חי" ומנוהל תוך כדי; עריכה נוגעת רק לערב שכבר נסגר
  const isNew = !game;
  const { players, activePlayers, addPlayer, saveGame, club, profile } = useStore();

  const [date, setDate] = useState(game?.date ?? todayISO());
  const [title, setTitle] = useState(game?.title ?? '');
  const [location, setLocation] = useState(game?.location ?? '');
  const [notes, setNotes] = useState(game?.notes ?? '');
  const [buyInAmount, setBuyInAmount] = useState(game?.buyInAmount ?? club?.defaultBuyIn ?? 100);
  const [entries, setEntries] = useState<GameEntry[]>(game?.entries ?? []);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seated = new Set(entries.map((e) => e.playerId));
  const bench = activePlayers.filter((p) => !seated.has(p.id));

  const totals = useMemo(() => {
    const buyIn = round2(entries.reduce((s, e) => s + entryBuyIn(e, buyInAmount), 0));
    const cashOut = round2(entries.reduce((s, e) => s + e.cashOut, 0));
    return { buyIn, cashOut, diff: round2(cashOut - buyIn) };
  }, [entries, buyInAmount]);

  const balanced = Math.abs(totals.diff) < 0.005;

  const seat = (playerId: string) =>
    setEntries((prev) => [...prev, { playerId, buyIns: 1, extraBuyIn: 0, cashOut: 0 }]);

  const unseat = (playerId: string) => setEntries((prev) => prev.filter((e) => e.playerId !== playerId));

  const patch = (playerId: string, p: Partial<GameEntry>) =>
    setEntries((prev) => prev.map((e) => (e.playerId === playerId ? { ...e, ...p } : e)));

  const addAndSeat = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const player = await addPlayer(name);
      seat(player.id);
      setNewName('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!club) return;
    const id = game?.id ?? newId();
    setBusy(true);
    setError(null);
    try {
      await saveGame({
        id,
        clubId: club.id,
        date,
        title: title.trim(),
        location: location.trim(),
        notes: notes.trim(),
        buyInAmount,
        // הדילר הוא מי שפתח את הערב; בעריכה הוא נשאר מי שהיה
        dealerId: game?.dealerId ?? profile?.id ?? null,
        status: game?.status ?? 'live',
        entries,
        paidTransfers: game?.paidTransfers ?? [],
        createdAt: game?.createdAt ?? new Date().toISOString(),
      });
      onDone(id);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  /** מאזן את הקופה: מוסיף/מוריד את ההפרש לשחקן שנבחר. */
  const balanceOn = (playerId: string) => {
    patch(playerId, { cashOut: round2((entries.find((e) => e.playerId === playerId)?.cashOut ?? 0) - totals.diff) });
  };

  return (
    <div className="fade-in">
      <div className="section-head">
        <div>
          <h1>{isNew ? 'פתיחת ערב' : 'עריכת ערב'}</h1>
          <p>
            {isNew
              ? 'בוחרים מי יושב לשולחן ומתחילים. אפשר להוסיף כניסות ושחקנים תוך כדי המשחק.'
              : 'עדכון הסכומים של ערב שכבר נסגר — ההעברות יחושבו מחדש.'}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={onCancel}>ביטול</button>
      </div>

      <div className="card">
        <div className="grid-2">
          <div className="field">
            <label>תאריך</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>סכום כניסה (buy-in) בודד</label>
            <input className="input num" type="number" min={0} step={5} value={buyInAmount} onChange={(e) => setBuyInAmount(num(e.target.value))} />
          </div>
          <div className="field">
            <label>מיקום</label>
            <input className="input" placeholder="אצל מי משחקים?" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="field">
            <label>כותרת (לא חובה)</label>
            <input className="input" placeholder="ערב שישי / טורניר החודש" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>מי שיחק?</h2>
          <span className="hint">{entries.length} שחקנים על השולחן</span>
        </div>

        {entries.length === 0 && <p className="muted" style={{ fontSize: 13.5, marginBottom: 12 }}>בחרו שחקנים מהרשימה למטה כדי להתחיל.</p>}

        {entries.length > 0 && (
          <>
            <div className="entry-labels" style={isNew ? { gridTemplateColumns: 'minmax(120px, 1.4fr) 132px 100px auto' } : undefined}>
              <span>שחקן</span>
              <span style={{ textAlign: 'center' }}>כניסות</span>
              <span style={{ textAlign: 'center' }}>תוספת ₪</span>
              {!isNew && <span style={{ textAlign: 'center' }}>יצא עם ₪</span>}
              <span style={{ textAlign: 'center' }}>{isNew ? 'סה״כ' : 'מאזן'}</span>
            </div>
            {entries.map((e) => {
              const player = players.find((p) => p.id === e.playerId);
              const net = round2(e.cashOut - entryBuyIn(e, buyInAmount));
              return (
                <div className="entry" key={e.playerId} style={isNew ? { gridTemplateColumns: 'minmax(120px, 1.4fr) 132px 100px auto' } : undefined}>
                  <div className="who">
                    <Avatar player={player} size="sm" />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{player?.name ?? '—'}</span>
                  </div>
                  <div>
                    <div className="mobile-label">כניסות</div>
                    <Stepper value={e.buyIns} min={0} onChange={(v) => patch(e.playerId, { buyIns: v })} />
                  </div>
                  <div>
                    <div className="mobile-label">תוספת ₪</div>
                    <input
                      className="input num"
                      type="number"
                      step={5}
                      value={e.extraBuyIn || ''}
                      placeholder="0"
                      onChange={(ev) => patch(e.playerId, { extraBuyIn: num(ev.target.value) })}
                    />
                  </div>
                  {!isNew && (
                    <div>
                      <div className="mobile-label">יצא עם ₪</div>
                      <input
                        className="input num"
                        type="number"
                        step={5}
                        inputMode="decimal"
                        value={e.cashOut || ''}
                        placeholder="0"
                        onChange={(ev) => patch(e.playerId, { cashOut: num(ev.target.value) })}
                      />
                    </div>
                  )}
                  <div className="tail">
                    {isNew ? (
                      <span className="entry-net muted">{money(entryBuyIn(e, buyInAmount))}</span>
                    ) : (
                      <span className={`entry-net ${net > 0 ? 'pos' : net < 0 ? 'neg' : 'muted'}`}>{signedMoney(net)}</span>
                    )}
                    <button className="btn btn-sm btn-ghost" onClick={() => unseat(e.playerId)} title="הסרה מהשולחן">✕</button>
                  </div>
                </div>
              );
            })}
          </>
        )}

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
            placeholder="שחקן חדש..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void addAndSeat()}
          />
          <button className="btn btn-sm" onClick={() => void addAndSeat()} disabled={!newName.trim() || busy}>הוספה לשולחן</button>
        </div>
      </div>

      <div className="card">
        {isNew ? (
          <div className="stat-grid" style={{ marginBottom: 14 }}>
            <Tile label="סה״כ בקופה" value={money(totals.buyIn)} />
            <Tile label="שחקנים" value={String(entries.length)} />
          </div>
        ) : (
          <div className="stat-grid" style={{ marginBottom: 14 }}>
            <Tile label="סה״כ נכנס לקופה" value={money(totals.buyIn)} />
            <Tile label="סה״כ יצא מהשולחן" value={money(totals.cashOut)} />
            <Tile label="הפרש" value={signedMoney(totals.diff)} tone={balanced ? 'ok' : 'bad'} />
          </div>
        )}

        {!isNew && <div className={`balance-banner ${balanced ? 'ok' : 'bad'}`}>
          <span style={{ fontSize: 18 }}>{balanced ? '✓' : '⚠️'}</span>
          {balanced ? (
            <span>הקופה מאוזנת — מה שנכנס שווה למה שיצא.</span>
          ) : (
            <span>
              חסרים {money(Math.abs(totals.diff))} {totals.diff > 0 ? 'יותר מדי בקופה' : 'בקופה'} — בדקו את הספירה או אזנו על שחקן.
            </span>
          )}
        </div>}

        {!isNew && !balanced && entries.length > 0 && (
          <div className="row" style={{ marginTop: 10, gap: 8 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>איזון מהיר על:</span>
            {entries.map((e) => {
              const player = players.find((p) => p.id === e.playerId);
              return (
                <button key={e.playerId} className="chip" style={{ cursor: 'pointer' }} onClick={() => balanceOn(e.playerId)}>
                  {player?.emoji} {player?.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="field" style={{ marginTop: 14 }}>
          <label>הערות לערב</label>
          <textarea className="textarea" placeholder="באד ביט של הערב, מי הביא פיצה..." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn btn-primary btn-block" onClick={() => void save()} disabled={entries.length < 2 || busy}>
            {busy ? 'שומר...' : isNew ? '🎲 התחלת הערב' : 'שמירת שינויים'}
          </button>
        </div>
        {entries.length < 2 && <p className="muted" style={{ fontSize: 12.5, marginTop: 8, textAlign: 'center' }}>צריך לפחות שני שחקנים.</p>}
        {error && <div className="balance-banner bad" style={{ marginTop: 12 }}>{error}</div>}
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value" style={{ color: tone === 'ok' ? 'var(--green)' : tone === 'bad' ? 'var(--red)' : undefined }}>{value}</div>
    </div>
  );
}
