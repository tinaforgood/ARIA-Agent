/**
 * Circular progress ring for sidebar stats.
 * @param {{ value: number; size?: number; stroke?: number; className?: string }} props
 */
export function ProgressRing({
  value,
  size = 88,
  stroke = 8,
  className = '',
}) {
  const r = (size - stroke) / 2 - 2
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, value))
  const offset = circ - (pct / 100) * circ

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#E5E7EB"
        strokeWidth={stroke}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#2563EB"
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-gray-900 text-[15px] font-bold"
      >
        {pct}%
      </text>
    </svg>
  )
}
