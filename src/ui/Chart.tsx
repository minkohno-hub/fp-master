/** 軽量な折れ線グラフ（SVG）。null の点は線を途切れさせる */
export function LineChart({
  points,
  max = 1,
  label,
  format = (v: number) => `${Math.round(v * 100)}%`,
}: {
  points: { x: string; y: number | null }[];
  max?: number;
  label: string;
  format?: (v: number) => string;
}) {
  const W = 320;
  const H = 120;
  const pad = 24;
  const n = points.length;
  const px = (i: number) => pad + (n <= 1 ? 0 : (i * (W - pad * 2)) / (n - 1));
  const py = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const segs: string[] = [];
  let cur = '';
  points.forEach((p, i) => {
    if (p.y === null) {
      if (cur) segs.push(cur);
      cur = '';
      return;
    }
    cur += `${cur ? 'L' : 'M'}${px(i).toFixed(1)},${py(p.y).toFixed(1)}`;
  });
  if (cur) segs.push(cur);
  const valid = points.filter((p) => p.y !== null);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={pad} x2={W - pad} y1={py(t * max)} y2={py(t * max)} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" />
            <text x={2} y={py(t * max) + 4} className="fill-slate-400 text-[9px]">
              {format(t * max)}
            </text>
          </g>
        ))}
        {segs.map((d, i) => (
          <path key={i} d={d} fill="none" className="stroke-brand-600" strokeWidth="2" strokeLinejoin="round" />
        ))}
        {points.map((p, i) =>
          p.y === null ? null : <circle key={i} cx={px(i)} cy={py(p.y)} r="2.5" className="fill-brand-600" />,
        )}
        {n > 0 && (
          <>
            <text x={pad} y={H - 6} className="fill-slate-400 text-[9px]">
              {points[0]!.x.slice(5)}
            </text>
            <text x={W - pad} y={H - 6} textAnchor="end" className="fill-slate-400 text-[9px]">
              {points[n - 1]!.x.slice(5)}
            </text>
          </>
        )}
      </svg>
      <figcaption className="sr-only">
        {valid.map((p) => `${p.x}: ${format(p.y!)}`).join('、') || 'データなし'}
      </figcaption>
    </figure>
  );
}
