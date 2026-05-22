/**
 * StatsView — 统计分析页面
 *
 * 基于申康MR基准（2025Q4第71期）展示多项目横向统计：
 *   1. 全局概览：4 KPI 卡（本月立项数、直通率、平均周期、平均判定分）
 *   2. 合理性判定结果分布（甜甜圈图）
 *   3. 四维指标对比表（各项目 vs 申康基准）
 *   4. 项目周期时序图（各节点耗时横向折线）
 */

import { useState } from 'react'
import {
  BarChart3, TrendingUp, Clock, ShieldCheck,
  CheckCircle2, XCircle, AlertCircle, MinusCircle,
  ChevronDown, RefreshCw,
} from 'lucide-react'

// ─── 申康基准（2025Q4 第71期）─────────────────────────────────────────────────
const BENCHMARK = {
  daily_per_unit:  49.64,  // 日台均检查次数
  saturation:      78.84,  // 工作负荷饱和度 %
  waiting_days:     4.70,  // 候检时间 天
  positive_rate:   null,   // 阳性率基准（无全市均值，以60%为合格线）
  renewal_rate:    44.34,  // 设备成新率 %
}

// ─── 项目统计数据 ──────────────────────────────────────────────────────────────
const PROJECTS = [
  {
    id: 'p1', code: '31****0147', name: '更新替换',      type: '更新',
    verdict: 'exempt',      // exempt_renewal / pass / conditional / reject
    workload:  83.2, waiting: 3.5, positive_rate: 71.0, renewal_rate: 18.5,
    cycle_days: 12,  nodes: [1.2, 0.5, 2.1, 1.8, 1.5, 2.3, 1.6, 1.0],
  },
  {
    id: 'p2', code: '31****0263', name: '新增配置(A)',   type: '新增',
    verdict: 'conditional',
    workload:  80.3, waiting: 6.2, positive_rate: null, renewal_rate: null,
    cycle_days: 18,  nodes: [1.5, 0.8, 2.4, 2.2, 1.9, 2.8, 3.5, 2.9],
  },
  {
    id: 'p3', code: '31****0318', name: '新增(饱和)',    type: '新增',
    verdict: 'pass',
    workload:  93.2, waiting: 8.5, positive_rate: 78.0, renewal_rate: 45.2,
    cycle_days: 9,   nodes: [1.0, 0.4, 1.8, 1.6, 1.3, 1.9, 1.4, 0.6],
  },
  {
    id: 'p4', code: '31****0429', name: '换型升级',      type: '升级',
    verdict: 'conditional',
    workload:  80.3, waiting: 6.2, positive_rate: null, renewal_rate: null,
    cycle_days: 15,  nodes: [1.3, 0.6, 2.0, 1.9, 1.7, 2.5, 2.2, 1.8],
  },
  {
    id: 'p5', code: '31****0534', name: '新增配置(B)',   type: '新增',
    verdict: null,   // 未到判定节点
    workload:  null, waiting: null, positive_rate: null, renewal_rate: null,
    cycle_days: 5,   nodes: [1.1, null, null, null, null, null, null, null],
  },
  {
    id: 'p6', code: '31****0651', name: '新增(低阳)',    type: '新增',
    verdict: 'reject',
    workload:  88.5, waiting: 9.1, positive_rate: 52.0, renewal_rate: 38.0,
    cycle_days: 21,  nodes: [1.8, 0.9, 3.1, 2.7, 2.4, 3.6, 4.2, 2.3],
  },
]

const NODE_LABELS = ['需求梳理', '合理性判定', '竞品归并', '预算测算', '收益测算', '合规核验', '文书生成', '审批反馈']

const VERDICT_META = {
  pass:        { label: '通过',     Icon: CheckCircle2, cls: 'text-emerald-600', bg: 'bg-emerald-50', dot: '#22C55E' },
  exempt:      { label: '更新豁免', Icon: MinusCircle,  cls: 'text-blue-600',    bg: 'bg-blue-50',    dot: '#3B82F6' },
  conditional: { label: '有条件',   Icon: AlertCircle,  cls: 'text-amber-600',   bg: 'bg-amber-50',   dot: '#F59E0B' },
  reject:      { label: '驳回',     Icon: XCircle,      cls: 'text-red-600',     bg: 'bg-red-50',     dot: '#EF4444' },
  null:        { label: '待判定',   Icon: MinusCircle,  cls: 'text-slate-400',   bg: 'bg-slate-50',   dot: '#CBD5E1' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(val, unit = '', fallback = '—') {
  if (val === null || val === undefined) return fallback
  return `${val}${unit}`
}

function DimDot({ val, benchmark, higherBetter = true, isRate = false }) {
  if (val === null || val === undefined) {
    return <span className="inline-flex size-2.5 rounded-full bg-slate-200" title="暂无数据" />
  }
  const diff = val - benchmark
  const good = higherBetter ? diff >= 0 : diff <= 0
  const color = good ? '#22C55E' : Math.abs(diff) < benchmark * 0.1 ? '#F59E0B' : '#EF4444'
  return <span className="inline-flex size-2.5 rounded-full" style={{ backgroundColor: color }} title={`${val}${isRate ? '%' : '次'} (基准 ${benchmark})`} />
}

// ─── Donut chart ──────────────────────────────────────────────────────────────
function VerdictDonut() {
  const counted = PROJECTS.filter(p => p.verdict)
  const groups = [
    { key: 'pass',        count: counted.filter(p => p.verdict === 'pass').length },
    { key: 'exempt',      count: counted.filter(p => p.verdict === 'exempt').length },
    { key: 'conditional', count: counted.filter(p => p.verdict === 'conditional').length },
    { key: 'reject',      count: counted.filter(p => p.verdict === 'reject').length },
  ].filter(g => g.count > 0)

  const total = counted.length
  const R = 58, SW = 18, C = 2 * Math.PI * R, GAP = 4
  let cum = 0
  const segs = groups.map(g => {
    const pct = g.count / total
    const len = pct * C - GAP
    const offset = -(cum * C)
    cum += pct
    return { ...g, len, offset }
  })
  const size = R * 2 + SW + 8

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`${-SW/2-4} ${-SW/2-4} ${size} ${size}`}>
        <g transform={`rotate(-90 ${R} ${R})`}>
          {segs.map(seg => (
            <circle key={seg.key} cx={R} cy={R} r={R} fill="none"
              stroke={VERDICT_META[seg.key].dot} strokeWidth={SW}
              strokeDasharray={`${seg.len} ${C - seg.len}`}
              strokeDashoffset={seg.offset}
            />
          ))}
        </g>
        <text x={R} y={R - 5}  textAnchor="middle" fontSize={10} fill="#94a3b8">已判定</text>
        <text x={R} y={R + 16} textAnchor="middle" fontSize={22} fontWeight={700} fill="#0f172a">{total}</text>
        <text x={R} y={R + 30} textAnchor="middle" fontSize={10} fill="#94a3b8">项目</text>
      </svg>
      <div className="flex flex-col gap-2.5">
        {groups.map(g => {
          const m = VERDICT_META[g.key]
          const { Icon } = m
          return (
            <div key={g.key} className="flex items-center gap-2 text-[12.5px]">
              <Icon className={`size-4 shrink-0 ${m.cls}`} strokeWidth={1.75} />
              <span className="text-slate-600">{m.label}</span>
              <span className="ml-auto font-semibold text-slate-800">{g.count} 项</span>
              <span className="text-slate-400 text-[11px]">{((g.count / total) * 100).toFixed(0)}%</span>
            </div>
          )
        })}
        <div className="flex items-center gap-2 text-[12.5px] border-t border-slate-100 pt-2">
          <MinusCircle className="size-4 shrink-0 text-slate-300" strokeWidth={1.75} />
          <span className="text-slate-400">待判定</span>
          <span className="ml-auto font-semibold text-slate-500">{PROJECTS.filter(p => !p.verdict).length} 项</span>
        </div>
      </div>
    </div>
  )
}

// ─── Sparkline for cycle ──────────────────────────────────────────────────────
function CycleBar({ days, max }) {
  const pct = (days / max) * 100
  const color = days <= 10 ? '#22C55E' : days <= 16 ? '#F59E0B' : '#EF4444'
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-[100px] overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="w-10 text-right text-[12px] font-semibold tabular-nums" style={{ color }}>{days}天</span>
    </div>
  )
}

// ─── Node heatmap sparkline ───────────────────────────────────────────────────
function NodeHeat({ nodes }) {
  const max = Math.max(...nodes.filter(Boolean))
  return (
    <div className="flex gap-0.5 items-end h-6">
      {nodes.map((v, i) => {
        if (v === null) return <div key={i} className="w-3 h-full rounded-sm bg-slate-100" />
        const h = Math.max(4, (v / max) * 22)
        const color = v > 3 ? '#EF4444' : v > 2 ? '#F59E0B' : '#3B82F6'
        return <div key={i} className="w-3 rounded-sm" style={{ height: `${h}px`, backgroundColor: color, alignSelf: 'flex-end' }} title={`${NODE_LABELS[i]}: ${v}天`} />
      })}
    </div>
  )
}

// ─── Section 1: KPI Overview ──────────────────────────────────────────────────
function KpiSection() {
  const done = PROJECTS.filter(p => p.verdict)
  const passed = done.filter(p => p.verdict === 'pass' || p.verdict === 'exempt').length
  const avgCycle = (PROJECTS.reduce((s, p) => s + p.cycle_days, 0) / PROJECTS.length).toFixed(1)
  const throughput = done.length ? ((passed / done.length) * 100).toFixed(0) : '—'

  const cards = [
    { label: '本月立项总数',  value: PROJECTS.length, unit: '项', Icon: BarChart3,  color: '#3B82F6', bg: 'bg-blue-50',    iconCls: 'text-blue-500',   sub: '含1项待判定' },
    { label: '合理性通过率',  value: `${throughput}`, unit: '%',  Icon: TrendingUp, color: '#22C55E', bg: 'bg-emerald-50', iconCls: 'text-emerald-500', sub: `${passed}/${done.length} 已判定通过` },
    { label: '平均项目周期',  value: avgCycle,         unit: '天', Icon: Clock,      color: '#8B5CF6', bg: 'bg-violet-50',  iconCls: 'text-violet-500',  sub: '含全流程最短9天' },
    { label: '驳回重工项目',  value: PROJECTS.filter(p => p.verdict === 'reject').length, unit: '项', Icon: ShieldCheck, color: '#EF4444', bg: 'bg-red-50', iconCls: 'text-red-500', sub: '需材料补充或延期' },
  ]

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((c, i) => {
        const { Icon } = c
        return (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[12.5px] text-slate-500">{c.label}</span>
              <div className={`flex size-9 items-center justify-center rounded-xl ${c.bg}`}>
                <Icon className={`size-5 ${c.iconCls}`} strokeWidth={1.75} />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[32px] font-bold text-slate-900 leading-none">{c.value}</span>
              <span className="text-[13px] text-slate-400">{c.unit}</span>
            </div>
            <p className="mt-1.5 text-[11.5px] text-slate-400">{c.sub}</p>
          </div>
        )
      })}
    </div>
  )
}

// ─── Section 2: Verdict distribution + Benchmark ──────────────────────────────
function VerdictAndBenchmarkSection() {
  return (
    <div className="flex gap-4">
      {/* Donut */}
      <div className="w-[320px] shrink-0 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[14px] font-semibold text-slate-900">合理性判定分布</span>
        </div>
        <VerdictDonut />
      </div>

      {/* Benchmark ref */}
      <div className="flex-1 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[14px] font-semibold text-slate-900">申康MR绩效基准</span>
          <span className="text-[12px] text-slate-400">2025Q4 第71期</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: '日台均检查次数', value: '49.64', unit: '次',   note: '绿灯≥市均，灯色仅供参考',        color: '#3B82F6' },
            { label: '工作负荷饱和度', value: '78.84', unit: '%',    note: '≥90% 判绿（高使用率）',           color: '#22C55E' },
            { label: '候检等待时间',   value: '4.70',  unit: '天',   note: '>7天 判绿（需求旺盛）',           color: '#F59E0B' },
            { label: '设备成新率',     value: '44.34', unit: '%',    note: '≤30% 豁免合理性审查',            color: '#8B5CF6' },
          ].map((b, i) => (
            <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
              <div className="mb-1 text-[11.5px] text-slate-400">{b.label}</div>
              <div className="flex items-baseline gap-1">
                <span className="text-[22px] font-bold" style={{ color: b.color }}>{b.value}</span>
                <span className="text-[12px] text-slate-400">{b.unit}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">{b.note}</p>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-5 border-t border-slate-100 pt-3 text-[11.5px]">
          {[
            { color: '#22C55E', label: '绿灯 — 指标达标' },
            { color: '#F59E0B', label: '黄灯 — 临界/数据缺失' },
            { color: '#EF4444', label: '红灯 — 指标不足' },
            { color: '#CBD5E1', label: '灰色 — 暂无数据' },
          ].map((l, i) => (
            <div key={i} className="flex items-center gap-1.5 text-slate-500">
              <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Section 3: Dim comparison table ─────────────────────────────────────────
function DimComparisonTable() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3">
        <span className="text-[14px] font-semibold text-slate-900">四维指标横向对比</span>
        <span className="ml-2 text-[12px] text-slate-400">/ 各项目指标 vs 申康基准</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-50 bg-slate-50/60">
            <th className="px-5 py-2.5 text-left text-[11.5px] font-medium text-slate-500">机构</th>
            <th className="px-4 py-2.5 text-left text-[11.5px] font-medium text-slate-500">项目</th>
            <th className="px-4 py-2.5 text-center text-[11.5px] font-medium text-slate-500">工作负荷</th>
            <th className="px-4 py-2.5 text-center text-[11.5px] font-medium text-slate-500">候检时间</th>
            <th className="px-4 py-2.5 text-center text-[11.5px] font-medium text-slate-500">检查阳性率</th>
            <th className="px-4 py-2.5 text-center text-[11.5px] font-medium text-slate-500">设备成新率</th>
            <th className="px-4 py-2.5 text-center text-[11.5px] font-medium text-slate-500">周期耗时分布</th>
            <th className="px-4 py-2.5 text-center text-[11.5px] font-medium text-slate-500">判定结果</th>
          </tr>
          {/* Benchmark row */}
          <tr className="bg-blue-50/30 border-b border-blue-100">
            <td colSpan={2} className="px-5 py-2 text-[11.5px] font-semibold text-blue-600">申康基准值（第71期）</td>
            <td className="px-4 py-2 text-center text-[12px] font-medium text-blue-700">78.84%</td>
            <td className="px-4 py-2 text-center text-[12px] font-medium text-blue-700">4.70天</td>
            <td className="px-4 py-2 text-center text-[12px] font-medium text-blue-700">≥60%</td>
            <td className="px-4 py-2 text-center text-[12px] font-medium text-blue-700">44.34%</td>
            <td className="px-4 py-2 text-center text-[11px] text-blue-400">—</td>
            <td className="px-4 py-2 text-center text-[11px] text-blue-400">—</td>
          </tr>
        </thead>
        <tbody>
          {PROJECTS.map((p, i) => {
            const m = VERDICT_META[p.verdict ?? 'null']
            const { Icon } = m
            return (
              <tr key={p.id} className={`border-b border-slate-50 transition-colors hover:bg-slate-50/50 ${i % 2 === 1 ? 'bg-slate-50/30' : ''}`}>
                <td className="px-5 py-3 font-mono text-[12px] text-slate-600">{p.code}</td>
                <td className="px-4 py-3">
                  <div className="text-[12.5px] font-medium text-slate-800">{p.name}</div>
                  <div className="text-[11px] text-slate-400">{p.type}</div>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <DimDot val={p.workload} benchmark={78.84} higherBetter />
                    <span className="text-[11.5px] tabular-nums text-slate-600">{fmt(p.workload, '%')}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <DimDot val={p.waiting} benchmark={4.70} higherBetter />
                    <span className="text-[11.5px] tabular-nums text-slate-600">{fmt(p.waiting, '天')}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <DimDot val={p.positive_rate} benchmark={60} higherBetter isRate />
                    <span className="text-[11.5px] tabular-nums text-slate-600">{fmt(p.positive_rate, '%')}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center gap-1">
                    {/* renewal_rate: lower means older device — exempt if ≤30% */}
                    <span className={`inline-flex size-2.5 rounded-full ${
                      p.renewal_rate === null ? 'bg-slate-200' :
                      p.renewal_rate <= 30    ? 'bg-blue-400' :
                      p.renewal_rate <= 50    ? 'bg-emerald-400' : 'bg-slate-300'
                    }`} title={p.renewal_rate !== null ? `成新率 ${p.renewal_rate}%` : '暂无数据'} />
                    <span className="text-[11.5px] tabular-nums text-slate-600">{fmt(p.renewal_rate, '%')}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <NodeHeat nodes={p.nodes} />
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium ${m.bg} ${m.cls}`}>
                    <Icon className="size-3.5 shrink-0" strokeWidth={2} />
                    {m.label}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Section 4: Cycle breakdown ───────────────────────────────────────────────
function CycleSection() {
  const maxDays = Math.max(...PROJECTS.map(p => p.cycle_days))
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <span className="text-[14px] font-semibold text-slate-900">项目周期总览</span>
          <span className="ml-2 text-[12px] text-slate-400">/ 全流程天数 · 色块高度 = 节点耗时占比</span>
        </div>
        <div className="flex items-center gap-3 text-[11.5px] text-slate-400">
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-400 inline-block" />≤10天</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-400 inline-block" />11–16天</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-red-400 inline-block" />&gt;16天</span>
        </div>
      </div>
      <div className="space-y-3">
        {PROJECTS.map(p => {
          const m = VERDICT_META[p.verdict ?? 'null']
          const { Icon } = m
          return (
            <div key={p.id} className="flex items-center gap-4">
              <div className="w-[220px] shrink-0">
                <div className="text-[12.5px] font-medium text-slate-800 truncate">{p.code}</div>
                <div className="text-[11px] text-slate-400">{p.name}</div>
              </div>
              <CycleBar days={p.cycle_days} max={maxDays} />
              <div className="ml-2 shrink-0">
                <NodeHeat nodes={p.nodes} />
              </div>
              <span className={`ml-auto shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${m.bg} ${m.cls}`}>
                <Icon className="size-3 shrink-0" strokeWidth={2} /> {m.label}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex items-center gap-1.5 rounded-xl bg-slate-50 px-4 py-2.5 text-[12px] text-slate-500">
        <span className="text-slate-400">提示：</span>
        色块高度代表各节点耗时，蓝色=正常，黄色=略高（&gt;2天），红色=阻塞（&gt;3天）。p2 / p6 在文书生成节点耗时最长。
      </div>
    </div>
  )
}

// ─── Sub-header ───────────────────────────────────────────────────────────────
function SubHeader({ period, onPeriod }) {
  const periods = ['本月', '近3月', '近6月', '全年']
  return (
    <div className="border-b border-slate-100 bg-white px-8 py-2.5">
      <div className="flex items-center gap-4">
        <span className="text-[12.5px] text-slate-500">统计周期：</span>
        <div className="flex gap-1">
          {periods.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => onPeriod(p)}
              className={[
                'rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                period === p ? 'bg-blue-500 text-white' : 'text-slate-500 hover:bg-slate-100',
              ].join(' ')}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 text-[12px] text-slate-400">
          <span>数据更新 · 刚刚</span>
          <button type="button" className="rounded-lg p-1 hover:bg-slate-50">
            <RefreshCw className="size-3.5" strokeWidth={1.75} />
          </button>
          <span className="rounded-lg border border-slate-200 px-2.5 py-1.5">2025-05-20</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function StatsView() {
  const [period, setPeriod] = useState('本月')

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <SubHeader period={period} onPeriod={setPeriod} />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1600px] space-y-5 px-8 py-6">

          {/* Title */}
          <div>
            <h1 className="text-[20px] font-bold text-slate-900">统计分析</h1>
            <p className="mt-0.5 text-[13px] text-slate-500">
              基于申康MR绩效基准（2025Q4·第71期）的多项目横向对比分析 · {period}
            </p>
          </div>

          <KpiSection />
          <VerdictAndBenchmarkSection />
          <DimComparisonTable />
          <CycleSection />

        </div>
      </div>
    </div>
  )
}
