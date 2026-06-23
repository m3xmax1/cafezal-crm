// Spider/radar chart in puro SVG (niente dipendenze).
// axes: [{ key, label }]; series: [{ name, color, values: { [key]: number } }]
export default function RadarChart({ axes, series, min = 6, max = 10, size = 300 }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 42;
  const n = axes.length;
  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const at = (i, t) => [cx + Math.cos(angle(i)) * r * t, cy + Math.sin(angle(i)) * r * t];
  const point = (i, val) => at(i, (Math.max(min, Math.min(max, val)) - min) / (max - min || 1));
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto block" style={{ maxWidth: size }} role="img" aria-label="Radar cupping">
      {rings.map((rr, ri) => (
        <polygon
          key={ri}
          points={axes.map((_, i) => at(i, rr).join(',')).join(' ')}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="1"
        />
      ))}
      {axes.map((a, i) => {
        const [x, y] = at(i, 1);
        const [lx, ly] = at(i, 1.16);
        return (
          <g key={a.key}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={lx} y={ly} fontSize="9.5" textAnchor="middle" dominantBaseline="middle" fill="#64748b">{a.label}</text>
          </g>
        );
      })}
      {series.map((s, si) => (
        <polygon
          key={si}
          points={axes.map((a, i) => point(i, Number(s.values[a.key]) || min).join(',')).join(' ')}
          fill={s.color}
          fillOpacity="0.14"
          stroke={s.color}
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}
