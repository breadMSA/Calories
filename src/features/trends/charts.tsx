// Lightweight SVG charts rendered at the container's pixel width so text stays legible.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { shortDate } from '../../lib/dates';
import { fmt } from '../../lib/format';

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

const PAD = { top: 8, right: 8, bottom: 22, left: 40 };

/** Pick ~5 evenly spaced x labels so they never collide. */
function labelEvery(count: number, width: number) {
  return Math.max(1, Math.ceil(count / Math.max(2, Math.floor(width / 56))));
}

function Tip({ children }: { children?: ReactNode }) {
  return <div className="chart-tip">{children ?? ' '}</div>;
}

export function CalorieBars({
  days,
  target,
  ceiling,
}: {
  days: { date: string; calories: number; logged: boolean }[];
  target: number;
  ceiling: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 180;
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(target * 1.15, ...days.map((d) => d.calories)));
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const slot = days.length ? innerW / days.length : 0;
  const gap = Math.min(2, slot * 0.2);
  const barW = Math.max(1, slot - gap);
  const every = labelEvery(days.length, innerW);
  const ticks = [0, max / 2, max];
  const h = hover != null ? days[hover] : null;

  return (
    <div ref={ref}>
      <Tip>
        {h && (
          <>
            <span>{shortDate(h.date)}</span>
            <span>{h.logged ? `${fmt(h.calories)} kcal（目標 ${fmt(target)}）` : '未記錄'}</span>
          </>
        )}
      </Tip>
      {width > 0 && (
        <svg
          className="chart"
          width={width}
          height={height}
          role="img"
          aria-label="每日熱量長條圖"
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
              <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end">
                {fmt(t)}
              </text>
            </g>
          ))}
          {days.map((d, i) => {
            const x = PAD.left + i * slot + gap / 2;
            const value = d.logged ? d.calories : max * 0.015;
            const top = y(value);
            const r = Math.min(4, barW / 2, (PAD.top + innerH - top) / 2);
            const bottom = PAD.top + innerH;
            // Rounded top, square baseline.
            const path = `M${x},${bottom} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${bottom} Z`;
            const over = ceiling && d.calories > target * 1.05;
            return (
              <g key={d.date}>
                <path
                  className={`bar${!d.logged ? ' is-empty' : over ? ' is-over' : ''}`}
                  d={path}
                  opacity={hover == null || hover === i ? 1 : 0.55}
                />
                <rect
                  x={PAD.left + i * slot}
                  y={PAD.top}
                  width={slot}
                  height={innerH}
                  fill="transparent"
                  onPointerEnter={() => setHover(i)}
                  onPointerDown={() => setHover(i)}
                />
                {i % every === 0 && (
                  <text x={x + barW / 2} y={height - 6} textAnchor="middle">
                    {shortDate(d.date)}
                  </text>
                )}
              </g>
            );
          })}
          <line className="target" x1={PAD.left} x2={width - PAD.right} y1={y(target)} y2={y(target)} />
        </svg>
      )}
      <div className="legend">
        <span>
          <i className="dashed" />
          目標 {fmt(target)} kcal
        </span>
        {ceiling && (
          <span>
            <span className="dot dot-fat" />
            超過目標 5% 以上
          </span>
        )}
      </div>
    </div>
  );
}

export function WeightChart({ points }: { points: { date: string; kg: number; trend: number }[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 180;
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;

  const values = points.flatMap((p) => [p.kg, p.trend]);
  const lo = Math.floor(Math.min(...values) - 0.5);
  const hi = Math.ceil(Math.max(...values) + 0.5);
  const t0 = Date.parse(points[0].date);
  const t1 = Date.parse(points[points.length - 1].date);
  const span = Math.max(1, t1 - t0);
  const x = (date: string) => PAD.left + (points.length === 1 ? innerW / 2 : ((Date.parse(date) - t0) / span) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.trend).toFixed(1)}`).join(' ');
  const ticks = [lo, (lo + hi) / 2, hi];
  const every = labelEvery(points.length, innerW);
  const h = hover != null ? points[hover] : null;

  const onMove = (clientX: number, el: SVGSVGElement) => {
    const px = clientX - el.getBoundingClientRect().left;
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(x(points[i].date) - px) < Math.abs(x(points[best].date) - px)) best = i;
    }
    setHover(best);
  };

  return (
    <div ref={ref}>
      <Tip>
        {h && (
          <>
            <span>{shortDate(h.date)}</span>
            <span>
              體重 {fmt(h.kg, 1)} kg · 趨勢 {fmt(h.trend, 1)} kg
            </span>
          </>
        )}
      </Tip>
      {width > 0 && (
        <svg
          className="chart"
          width={width}
          height={height}
          role="img"
          aria-label="體重趨勢圖"
          onPointerMove={(e) => onMove(e.clientX, e.currentTarget)}
          onPointerDown={(e) => onMove(e.clientX, e.currentTarget)}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
              <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end">
                {fmt(t, 1)}
              </text>
            </g>
          ))}
          {h && <line className="hover-line" x1={x(h.date)} x2={x(h.date)} y1={PAD.top} y2={PAD.top + innerH} />}
          {points.map((p, i) => (
            <g key={p.date}>
              <circle className="weight-dot" cx={x(p.date)} cy={y(p.kg)} r={hover === i ? 5 : 4} />
              {i % every === 0 && (
                <text x={x(p.date)} y={height - 6} textAnchor="middle">
                  {shortDate(p.date)}
                </text>
              )}
            </g>
          ))}
          <path className="trend-line" d={line} />
        </svg>
      )}
      <div className="legend">
        <span>
          <i />
          趨勢
        </span>
        <span>
          <i className="dot-outline" />
          每日量測
        </span>
      </div>
    </div>
  );
}
