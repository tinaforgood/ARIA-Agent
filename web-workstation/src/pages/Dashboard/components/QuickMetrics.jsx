/**
 * QuickMetrics — Section 1: 核心业务指标概览（全局驾驶舱）
 *
 * Card layout:
 *   ┌── left: donut + legend ──┬── right: KPI grid ──────────────────────┐
 *   │  本年度立项总盘          │  [累计拦截数据冲突数]   (full-width row) │
 *   │  [SVG donut]             │  [一次性通过率 ring]  [驳回重报率 ring]  │
 *   └──────────────────────────┴─────────────────────────────────────────┘
 *   └── 8 类材料 icon grid ──────────────────────────────────────────────┘
 */

import { ArrowUp, ArrowDown } from 'lucide-react'

// ── Donut chart ───────────────────────────────────────────────────────────────
function DonutChart({ total, segments }) {
  const R    = 46
  const SW   = 12          // stroke width
  const SIZE = 136
  const CX   = SIZE / 2
  const CY   = SIZE / 2
  const C    = 2 * Math.PI * R   // ≈ 289.0
  const GAP  = 5                  // px gap between segments

  let cumLen = 0
  const arcs = segments.map((seg) => {
    const segLen  = (seg.pct / 100) * C
    const dashLen = Math.max(0, segLen - GAP)
    const arc     = { ...seg, dashLen, dashOffset: -cumLen }
    cumLen += segLen
    return arc
  })

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={{ width: SIZE, height: SIZE, flexShrink: 0 }}
    >
      {/* Track */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f1f5f9" strokeWidth={SW} />

      {/* Colored arcs */}
      <g transform={`rotate(-90 ${CX} ${CY})`}>
        {arcs.map((arc) => (
          <circle
            key={arc.id}
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={arc.color}
            strokeWidth={SW - 1}
            strokeDasharray={`${arc.dashLen} ${C}`}
            strokeDashoffset={arc.dashOffset}
            strokeLinecap="butt"
          />
        ))}
      </g>

      {/* Center labels */}
      <text x={CX} y={CY - 11} textAnchor="middle" fill="#94a3b8" fontSize="10">总计</text>
      <text x={CX} y={CY + 11} textAnchor="middle" fill="#0f172a" fontSize="26" fontWeight="700">
        {total}
      </text>
      <text x={CX} y={CY + 27} textAnchor="middle" fill="#94a3b8" fontSize="10">个项目</text>
    </svg>
  )
}

// ── Ring progress (for pass-rate / reject-rate) ───────────────────────────────
function RingProgress({ value, color = '#3B82F6', size = 70 }) {
  const r  = (size - 12) / 2
  const C  = 2 * Math.PI * r
  const cx = size / 2
  const cy = size / 2
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="7" />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${(value / 100) * C} ${C}`}
        strokeDashoffset="0"
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text
        x={cx} y={cy + 5}
        textAnchor="middle"
        fill="#0f172a" fontSize="13" fontWeight="700"
      >
        {value}%
      </text>
    </svg>
  )
}

// ── Trend chip ────────────────────────────────────────────────────────────────
function TrendChip({ dir, value, label }) {
  const up   = dir === 'up'
  const down = dir === 'down'
  const cls  = up   ? 'bg-emerald-50 text-emerald-600'
             : down ? 'bg-red-50 text-red-500'
             :        'bg-slate-50 text-slate-400'
  const Icon = up ? ArrowUp : down ? ArrowDown : null
  return (
    <span className="flex items-center gap-1 text-[11px] text-slate-400">
      {label}
      <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium ${cls}`}>
        {Icon && <Icon className="size-2.5" strokeWidth={2.5} />}
        {value}
      </span>
    </span>
  )
}

// ── KPI "badge" tile (累计拦截数据冲突数) ─────────────────────────────────────
function KpiBadge({ kpi }) {
  const Icon = kpi.icon
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${kpi.iconBg}`}>
        <Icon className={`size-5 ${kpi.iconColor}`} strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] text-slate-500">{kpi.label}</p>
        <div className="mt-0.5 flex items-baseline gap-1">
          <span className="text-[28px] font-bold leading-none tracking-tight text-slate-900">
            {kpi.value}
          </span>
          {kpi.unit && <span className="text-[13px] text-slate-400">{kpi.unit}</span>}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <TrendChip dir={kpi.trendDir} value={kpi.trendValue} label={kpi.trendLabel} />
          {kpi.subtitle && (
            <span className="text-[11px] text-slate-400">{kpi.subtitle}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── KPI "ring" tile (通过率 / 驳回率) ─────────────────────────────────────────
function KpiRing({ kpi }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-3.5">
      <p className="text-center text-[11.5px] leading-snug text-slate-500">{kpi.label}</p>
      <RingProgress value={kpi.value} color={kpi.ringColor} size={70} />
      <TrendChip dir={kpi.trendDir} value={kpi.trendValue} label={kpi.trendLabel} />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function QuickMetrics({ stats, kpis, materialTypes }) {
  const badgeKpi = kpis.find((k) => k.type === 'badge')
  const ringKpis = kpis.filter((k) => k.type === 'ring')

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">

      {/* ── Section title ── */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
        <span className="size-1.5 rounded-full bg-blue-500" />
        <h2 className="text-[14px] font-semibold text-slate-900">
          一、核心业务指标概览
          <span className="ml-1.5 text-[12px] font-normal text-slate-400">（全局驾驶舱）</span>
        </h2>
      </div>

      {/* ── Top area: donut left + KPIs right ── */}
      <div className="flex gap-5 p-5 pb-4">

        {/* Donut + legend */}
        <div className="flex shrink-0 flex-col items-center gap-3">
          <p className="self-start text-[12px] font-medium text-slate-600">本年度立项总盘</p>
          <DonutChart total={stats.total} segments={stats.segments} />
          <div className="flex flex-col gap-1.5 self-start">
            {stats.segments.map((seg) => (
              <div key={seg.id} className="flex items-center gap-1.5 text-[11.5px]">
                <span
                  className="inline-block size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-slate-500">{seg.label}</span>
                <span className="font-semibold text-slate-900">{seg.count}</span>
                <span className="text-slate-400">({seg.pct}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* KPI grid */}
        <div className="flex flex-1 flex-col gap-3">
          {badgeKpi && <KpiBadge kpi={badgeKpi} />}
          <div className="flex gap-3">
            {ringKpis.map((k) => <KpiRing key={k.id} kpi={k} />)}
          </div>
        </div>

      </div>

      {/* ── Bottom: 8-material type icon grid ── */}
      <div className="border-t border-slate-100 px-5 py-4">
        <p className="mb-3 text-[11.5px] text-slate-400">
          8 类材料一键解析，智能驱动立项全流程
        </p>
        <div className="grid grid-cols-8 gap-2">
          {materialTypes.map((m) => {
            const Icon = m.icon
            return (
              <button
                key={m.id}
                type="button"
                className="group flex flex-col items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50/60 px-2 py-2.5 text-center transition-all hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-sm"
              >
                <div className={`flex size-8 items-center justify-center rounded-lg ${m.iconCls}`}>
                  <Icon className="size-4" strokeWidth={1.75} />
                </div>
                <span className="text-[10px] leading-tight text-slate-600 group-hover:text-blue-700">
                  {m.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

    </div>
  )
}
