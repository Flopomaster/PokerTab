import { useEffect, useMemo, useRef, useState } from 'react';
import { money, formatDate } from '../lib/format';

/** מודד את רוחב המכולה כדי שהגרף ימלא אותה בלי למתוח את הטקסט. */
function useContainerWidth(min: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(min);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(min, el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return { ref, width };
}

export interface Series {
  id: string;
  name: string;
  color: string;
  emoji?: string;
  /** null = לא שיחק/עוד לא נכנס לגרף */
  values: (number | null)[];
}

interface LineProps {
  labels: string[];
  series: Series[];
  height?: number;
}

/** גרף קו מרובה-סדרות, SVG טהור — מאזן מצטבר לאורך הערבים. */
export function MultiLineChart({ labels, series, height = 300 }: LineProps) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<number | null>(null);

  const visible = series.filter((s) => !hidden.has(s.id));
  const minWidth = Math.max(560, labels.length * 64);
  const { ref, width } = useContainerWidth(minWidth);
  const padX = 46;
  const padTop = 16;
  const padBottom = 34;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;

  const { min, max } = useMemo(() => {
    const all = visible.flatMap((s) => s.values.filter((v): v is number => v !== null));
    if (all.length === 0) return { min: -100, max: 100 };
    let lo = Math.min(0, ...all);
    let hi = Math.max(0, ...all);
    if (hi === lo) { hi += 100; lo -= 100; }
    const pad = (hi - lo) * 0.12;
    return { min: lo - pad, max: hi + pad };
  }, [visible]);

  const x = (i: number) => padX + (labels.length <= 1 ? innerW / 2 : (i / (labels.length - 1)) * innerW);
  const y = (v: number) => padTop + innerH - ((v - min) / (max - min)) * innerH;

  const ticks = useMemo(() => {
    const out: number[] = [];
    const step = (max - min) / 4;
    for (let i = 0; i <= 4; i++) out.push(min + step * i);
    return out;
  }, [min, max]);

  const toggle = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div>
      <div className="chart-wrap" ref={ref}>
        <svg
          width={width}
          height={height}
          role="img"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const scale = width / rect.width;
            const px = (e.clientX - rect.left) * scale;
            const ratio = (px - padX) / innerW;
            const idx = Math.round(ratio * (labels.length - 1));
            setHover(Math.max(0, Math.min(labels.length - 1, idx)));
          }}
        >
          <defs>
            {visible.map((s) => (
              <linearGradient id={`fill-${s.id}`} key={s.id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={padX} x2={width - padX} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
              <text x={padX - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="#8ea79b">
                {Math.round(t)}
              </text>
            </g>
          ))}
          <line x1={padX} x2={width - padX} y1={y(0)} y2={y(0)} stroke="rgba(240,180,41,0.45)" strokeWidth="1.4" strokeDasharray="4 4" />

          {labels.map((l, i) => (
            <text key={i} x={x(i)} y={height - 12} textAnchor="middle" fontSize="10" fill="#8ea79b">
              {formatDate(l).slice(0, 5)}
            </text>
          ))}

          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={padTop} y2={padTop + innerH} stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
          )}

          {visible.map((s) => {
            const pts = s.values
              .map((v, i) => (v === null ? null : { x: x(i), y: y(v) }))
              .filter((p): p is { x: number; y: number } => p !== null);
            if (pts.length === 0) return null;
            const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
            const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${y(min).toFixed(1)} L${pts[0].x.toFixed(1)},${y(min).toFixed(1)} Z`;
            return (
              <g key={s.id}>
                <path d={area} fill={`url(#fill-${s.id})`} />
                <path d={line} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                {pts.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={hover !== null && Math.abs(p.x - x(hover)) < 1 ? 4.5 : 2.6} fill={s.color} />
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      {hover !== null && (
        <div className="card" style={{ marginTop: 10, padding: 12 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{formatDate(labels[hover])}</div>
          <div className="row" style={{ gap: 12 }}>
            {visible
              .map((s) => ({ s, v: s.values[hover] }))
              .filter((r) => r.v !== null)
              .sort((a, b) => (b.v as number) - (a.v as number))
              .map(({ s, v }) => (
                <span key={s.id} className="chip">
                  <span className="legend-dot" style={{ background: s.color }} />
                  {s.name}
                  <b className={(v as number) >= 0 ? 'pos' : 'neg'}>{money(v as number)}</b>
                </span>
              ))}
          </div>
        </div>
      )}

      <div className="legend">
        {series.map((s) => (
          <button key={s.id} className={`legend-item${hidden.has(s.id) ? ' off' : ''}`} onClick={() => toggle(s.id)}>
            <span className="legend-dot" style={{ background: s.color }} />
            {s.emoji} {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}

interface BarProps {
  labels: string[];
  values: number[];
  height?: number;
}

/** גרף עמודות רווח/הפסד לערב — ירוק מעל האפס, אדום מתחת. */
export function BarChart({ labels, values, height = 200 }: BarProps) {
  const minWidth = Math.max(420, labels.length * 54);
  const { ref, width } = useContainerWidth(minWidth);
  const padX = 40;
  const padTop = 12;
  const padBottom = 30;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;

  const maxAbs = Math.max(100, ...values.map((v) => Math.abs(v))) * 1.15;
  const y = (v: number) => padTop + innerH / 2 - (v / maxAbs) * (innerH / 2);
  const bw = Math.min(30, (innerW / Math.max(1, labels.length)) * 0.6);

  return (
    <div className="chart-wrap" ref={ref}>
      <svg width={width} height={height} role="img">
        <line x1={padX - 6} x2={width - padX + 6} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.16)" />
        {values.map((v, i) => {
          const cx = padX + (innerW / Math.max(1, labels.length)) * (i + 0.5);
          const top = v >= 0 ? y(v) : y(0);
          const h = Math.max(2, Math.abs(y(v) - y(0)));
          return (
            <g key={i}>
              <rect
                x={cx - bw / 2}
                y={top}
                width={bw}
                height={h}
                rx="5"
                fill={v >= 0 ? 'rgba(61,220,132,0.8)' : 'rgba(255,107,107,0.8)'}
              >
                <title>{`${formatDate(labels[i])}: ${money(v)}`}</title>
              </rect>
              <text x={cx} y={height - 10} textAnchor="middle" fontSize="9.5" fill="#8ea79b">
                {formatDate(labels[i]).slice(0, 5)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
