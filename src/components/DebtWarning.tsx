import type { OpenDebt } from '../types';
import { useStore } from '../state/store';
import { formatDate, money, round2 } from '../lib/format';
import { Modal } from './ui';

/** אזהרה לפני הושבת שחקן שיש לו חוב שטרם אושר משולחן קודם. */
export function DebtWarningModal({
  playerId,
  debts,
  onConfirm,
  onCancel,
}: {
  playerId: string;
  debts: OpenDebt[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { playerById } = useStore();
  const name = playerById(playerId)?.name ?? 'השחקן';
  const total = round2(debts.reduce((s, d) => s + d.amount, 0));

  return (
    <Modal title="⚠️ חוב פתוח" onClose={onCancel}>
      <p style={{ fontSize: 14.5, marginBottom: 14 }}>
        <b>{name}</b> עדיין לא סגר חוב משולחן קודם — {debts.length === 1 ? 'העברה אחת' : `${debts.length} העברות`} בסך{' '}
        <b>{money(total)}</b> {debts.length === 1 ? 'שטרם אושרה' : 'שטרם אושרו'} על ידי מי שאמור לקבל את הכסף.
      </p>

      <div style={{ marginBottom: 16 }}>
        {debts.map((d) => (
          <div className="lb-row" key={`${d.gameId}-${d.toPlayerId}`} style={{ cursor: 'default' }}>
            <span style={{ fontSize: 18 }}>{d.senderMarked ? '⏳' : '❗'}</span>
            <div className="lb-main">
              <div style={{ minWidth: 0 }}>
                <div className="lb-sub">אמור לקבל</div>
                <div className="lb-name">{playerById(d.toPlayerId)?.name ?? '—'}</div>
                <div className="lb-sub">
                  שולחן {formatDate(d.date)} · {d.senderMarked ? 'סומן כהועבר, לא אושר' : 'טרם הועבר'}
                </div>
              </div>
            </div>
            <div className="lb-net neg">{money(d.amount)}</div>
          </div>
        ))}
      </div>

      <p className="muted" style={{ fontSize: 12.5, marginBottom: 16 }}>
        החוב נסגר רק כשמי שאמור לקבל את הכסף מאשר שקיבל אותו.
      </p>

      <div className="row">
        <button className="btn btn-primary" onClick={onConfirm}>להושיב בכל זאת</button>
        <button className="btn btn-ghost" onClick={onCancel}>לא עכשיו</button>
      </div>
    </Modal>
  );
}
