import { useEffect } from 'react';
import type { ReactNode } from 'react';
/** כל ישות עם אימוג׳י וצבע — שחקן או פרופיל משתמש */
export interface AvatarLike {
  name?: string;
  displayName?: string;
  emoji: string;
  color: string;
}

export function Avatar({ player, size = 'md' }: { player?: AvatarLike | null; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'avatar lg' : size === 'sm' ? 'avatar sm' : 'avatar';
  if (!player) return <div className={cls}>❔</div>;
  return (
    <div
      className={cls}
      style={{ background: `${player.color}22`, borderColor: `${player.color}55`, boxShadow: `inset 0 0 18px ${player.color}18` }}
      title={player.name ?? player.displayName}
    >
      {player.emoji}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={wide ? { width: 'min(760px, 100%)' } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 18 }}>{title}</h2>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="סגירה">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: string; tone?: 'pos' | 'neg' | 'gold' }) {
  const color = tone === 'pos' ? 'var(--green)' : tone === 'neg' ? 'var(--red)' : tone === 'gold' ? 'var(--gold)' : undefined;
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value" style={{ color }}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: string; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <h3>{title}</h3>
      <p style={{ fontSize: 13.5, marginBottom: action ? 16 : 0 }}>{text}</p>
      {action}
    </div>
  );
}
