import React from 'react';

// Sparkline component. `data` is an array of numbers; renders a polyline
// (optionally with an area fill and end-dots). Used in Etusivu, Analytics.
export default function Spark({
  data,
  color = 'var(--blue)',
  area = true,
  w = 120,
  h = 40,
  dots = false,
}) {
  if (!data || data.length < 2) return null;
  const mn = Math.min(...data);
  const mx = Math.max(...data);
  const norm = (v) => h - ((v - mn) / (mx - mn || 1)) * (h - 4) - 2;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${norm(v)}`).join(' ');
  const id = 'sp' + Math.random().toString(36).slice(2, 8);

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {area && (
        <>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity=".30" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polyline points={pts + ` ${w},${h} 0,${h}`} fill={`url(#${id})`} stroke="none" />
        </>
      )}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" />
      {dots &&
        data.map((v, i) => (
          <circle key={i} cx={(i / (data.length - 1)) * w} cy={norm(v)} r="1.2" fill={color} />
        ))}
    </svg>
  );
}
