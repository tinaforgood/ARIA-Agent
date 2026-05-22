/**
 * ActivePipeline — Section 4: 全局项目流水线（指挥台卡片版）
 *
 * 布局：每个项目一张横向卡片
 *   Left  : 项目信息（名称 / 科室 / 类型 / 阶段 / 进度）
 *   Center: A1→A7 横向 Stepper（节点图标 + 连接线 + 标签）
 *   Right : 负责人 / 更新时间 / 操作按钮
 *
 * 卡片色调：正常=白底，卡点=orange-50，驳回=red-50
 *
 * Node status: 'done' | 'active' | 'shell' | 'error' | 'pending'
 */

import { useState } from 'react'
import { FileText } from 'lucide-react'

const PAGE_SIZE = 6

// ── 中文姓名脱敏（展示用；Avatar 须使用原始姓名取首字） ──────────────────────
const HAN_RE = /[\u4e00-\u9fff]/

function extractHanChars(str) {
  if (!str || typeof str !== 'string') return []
  return [...str].filter((c) => HAN_RE.test(c))
}

/** 两字：姓+*；三字及以上：姓 + * + 末字（与常见三字「姓+*+名」一致） */
function maskChineseDisplayName(fullName) {
  const han = extractHanChars(fullName)
  const n = han.length
  if (n === 0) return fullName ? '—' : ''
  if (n === 1) return `${han[0]}*`
  if (n === 2) return `${han[0]}*`
  return `${han[0]}*${han[n - 1]}`
}

/** 头像始终取原始姓名第一个汉字（姓氏），避免对脱敏串取到「*」 */
function ownerAvatarHanInitial(fullName) {
  const han = extractHanChars(fullName)
  return han[0] ?? '—'
}

// ── 判断项目状态 ──────────────────────────────────────────────────────────────
function rowTone(row) {
  const allErr = row.nodes.every((n) => n === 'error')
  if (allErr || row.progressTone === 'red') return 'rejected'
  if (row.nodes.some((n) => n === 'shell' || n === 'error')) return 'blocked'
  return 'normal'
}

// ── Node status icon（统一 SVG 圆形外框） ────────────────────────────────────
function NodeIcon({ status, size = 20 }) {
  const r = size / 2
  const cx = r, cy = r

  if (status === 'done') {
    // Fixed 20×20 viewBox → clean anchor points regardless of size prop
    return (
      <svg width={size} height={size} viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8.5" fill="#f0fdf4" stroke="#22c55e" strokeWidth="1.6" />
        <polyline
          points="5.5,10.5 8.5,13.5 14.5,7"
          fill="none" stroke="#22c55e" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    )
  }
  if (status === 'active') {
    return (
      <span className="relative inline-flex" style={{ width: size, height: size }}>
        <span className="absolute inset-0 animate-ping rounded-full bg-blue-300/30" />
        <span className="absolute -inset-1 rounded-full bg-blue-100/60" />
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative">
          <circle cx={cx} cy={cy} r={r - 1.5} fill="#eff6ff" stroke="#3b82f6" strokeWidth={2} />
          <circle cx={cx} cy={cy} r={r * 0.28} fill="#3b82f6" />
        </svg>
      </span>
    )
  }
  if (status === 'shell') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r - 1.5} fill="#fffbeb" stroke="#f59e0b" strokeWidth={1.75} />
        <line x1={r * 0.4} y1={cy} x2={r * 1.6} y2={cy}
          stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" />
      </svg>
    )
  }
  if (status === 'error') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r - 1.5} fill="#fef2f2" stroke="#ef4444" strokeWidth={1.75} />
        <line x1={r * 0.38} y1={r * 0.38} x2={r * 1.62} y2={r * 1.62}
          stroke="#ef4444" strokeWidth={1.75} strokeLinecap="round" />
        <line x1={r * 1.62} y1={r * 0.38} x2={r * 0.38} y2={r * 1.62}
          stroke="#ef4444" strokeWidth={1.75} strokeLinecap="round" />
      </svg>
    )
  }
  // pending
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r - 1.5} fill="none" stroke="#cbd5e1" strokeWidth={1.5} />
    </svg>
  )
}

// ── Horizontal Agent Stepper ──────────────────────────────────────────────────
function AgentStepper({ nodes, labels }) {
  return (
    <div className="relative flex w-full items-start justify-between">
      {/* Connecting line at vertical center of node circles (size=22 → top=11px) */}
      <div
        className="absolute left-[11px] right-[11px] top-[11px] h-px"
        style={{ backgroundColor: '#e2e8f0' }}
      />

      {nodes.map((status, idx) => (
        <div key={idx} className="relative z-10 flex flex-col items-center gap-[5px]">
          {/* Active glow ring */}
          {status === 'active' && (
            <span className="absolute -inset-[6px] -top-[5px] rounded-full bg-blue-100/70" />
          )}
          <NodeIcon status={status} size={22} />
          <span className="text-[9.5px] font-semibold leading-none text-slate-500">A{idx + 1}</span>
          <span className="whitespace-nowrap text-[10px] leading-none text-slate-400">{labels[idx]}</span>
        </div>
      ))}
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ value, tone }) {
  const barCls = tone === 'red' ? 'bg-red-400' : 'bg-blue-500'
  const txtCls = tone === 'red' ? 'text-red-500' : 'text-slate-600'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all ${barCls}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`w-7 text-right text-[11px] font-semibold tabular-nums ${txtCls}`}>{value}%</span>
    </div>
  )
}

// ── Type badge ────────────────────────────────────────────────────────────────
function TypeBadge({ type }) {
  const isNew = type === '新增'
  return (
    <span className={[
      'whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10.5px] font-medium',
      isNew ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-700',
    ].join(' ')}>
      {type}
    </span>
  )
}

// ── Stage label ───────────────────────────────────────────────────────────────
function StageLabel({ stage }) {
  const isRejected = stage.includes('驳回')
  return (
    <span className={[
      'whitespace-nowrap text-[11px]',
      isRejected ? 'font-semibold text-red-500' : 'text-slate-500',
    ].join(' ')}>
      {stage}
    </span>
  )
}

// ── Owner avatar ──────────────────────────────────────────────────────────────
function OwnerAvatar({ rawFullName }) {
  const initial = ownerAvatarHanInitial(rawFullName)
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-semibold text-blue-600">
      {initial}
    </span>
  )
}

// ── Action button ─────────────────────────────────────────────────────────────
function ActionButton({ tone }) {
  if (tone === 'rejected') {
    return (
      <button className="whitespace-nowrap rounded-lg border border-red-200 bg-white px-3 py-1 text-[11.5px] font-medium text-red-500 transition-colors hover:bg-red-50">
        查看驳回原因
      </button>
    )
  }
  if (tone === 'blocked') {
    return (
      <button className="whitespace-nowrap rounded-lg border border-orange-200 bg-white px-3 py-1 text-[11.5px] font-medium text-orange-600 transition-colors hover:bg-orange-50">
        处理卡点
      </button>
    )
  }
  return (
    <button className="whitespace-nowrap rounded-lg bg-blue-500 px-3 py-1 text-[11.5px] font-medium text-white transition-colors hover:bg-blue-600">
      查看详情
    </button>
  )
}

// ── Legend item ───────────────────────────────────────────────────────────────
function LegendItem({ status, label }) {
  return (
    <span className="flex items-center gap-1 text-[11px] text-slate-500">
      <NodeIcon status={status} size={13} />
      {label}
    </span>
  )
}

// ── Header stat badge ─────────────────────────────────────────────────────────
function StatBadge({ count, label, color }) {
  const cls = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-600',
    red:    'bg-red-50 text-red-500',
  }[color]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>
      <span className="font-bold">{count}</span> {label}
    </span>
  )
}

// ── Project row card ──────────────────────────────────────────────────────────
function PipelineCard({ row, nodeLabels }) {
  const tone = rowTone(row)

  const cardStyle = {
    normal:   'bg-white border-slate-100 hover:bg-slate-50/70',
    blocked:  'bg-orange-50/40 border-orange-100 hover:bg-orange-50/70',
    rejected: 'bg-red-50/40 border-red-100 hover:bg-red-50/70',
  }[tone]

  return (
    <div className={`flex items-center rounded-xl border transition-colors ${cardStyle}`}>

      {/* ── Left: project info ── */}
      <div className="flex w-[240px] shrink-0 flex-col gap-1.5 px-4 py-3.5">
        {/* Name */}
        <div className="flex items-center gap-1.5">
          <FileText className="size-3.5 shrink-0 text-blue-400" strokeWidth={1.75} />
          <span className="truncate text-[12.5px] font-semibold text-slate-800">{row.name}</span>
        </div>
        {/* Dept · type · stage */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[11px] text-slate-400">{row.dept}</span>
          <span className="text-[11px] text-slate-300">·</span>
          <TypeBadge type={row.type} />
          <span className="text-[11px] text-slate-300">·</span>
          <StageLabel stage={row.stage} />
        </div>
        {/* Progress */}
        <ProgressBar value={row.progress} tone={row.progressTone} />
      </div>

      {/* Divider */}
      <div className="mx-1 h-14 w-px shrink-0 bg-slate-100" />

      {/* ── Center: Agent stepper ── */}
      <div className="flex min-w-0 flex-1 items-center px-5 py-3.5">
        <AgentStepper nodes={row.nodes} labels={nodeLabels} />
      </div>

      {/* Divider */}
      <div className="mx-1 h-14 w-px shrink-0 bg-slate-100" />

      {/* ── Right: meta + action ── */}
      <div className="flex w-[158px] shrink-0 flex-col gap-2 px-4 py-3.5">
        {/* Owner + time */}
        <div className="flex items-center gap-2">
          <OwnerAvatar rawFullName={row.owner} />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-1 text-[12px] leading-snug">
              <span className="font-semibold text-slate-700">
                {maskChineseDisplayName(row.owner)}
              </span>
              {row.ownerDept ? (
                <span className="text-sm font-normal text-slate-400">
                  （{row.ownerDept}）
                </span>
              ) : null}
            </div>
            <div className="text-[10.5px] text-slate-400">{row.updatedAt}</div>
          </div>
        </div>
        <ActionButton tone={tone} />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ActivePipeline({ rows = [], nodeLabels = [] }) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pageRows   = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Header stats (computed from full rows list)
  const rejectedCount = rows.filter((r) => rowTone(r) === 'rejected').length
  const blockedCount  = rows.filter((r) => rowTone(r) === 'blocked').length
  const normalCount   = rows.length - rejectedCount - blockedCount

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-[14px] font-semibold text-slate-900 leading-tight">全局项目流水线</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">在途任务追踪 · A1 → A7</p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <StatBadge count={rows.length}    label="在途"   color="blue"   />
            <StatBadge count={normalCount}    label="正常"   color="green"  />
            <StatBadge count={blockedCount}   label="卡点"   color="orange" />
            <StatBadge count={rejectedCount}  label="驳回"   color="red"    />
          </div>
        </div>
        <button type="button" className="text-[12px] font-medium text-blue-600 hover:text-blue-700">
          查看全部 ›
        </button>
      </div>

      {/* ── Card list ── */}
      <div className="flex flex-col gap-2 p-4">
        {pageRows.map((row) => (
          <PipelineCard key={row.id} row={row} nodeLabels={nodeLabels} />
        ))}
        {pageRows.length === 0 && (
          <div className="py-12 text-center text-[13px] text-slate-400">暂无在途项目</div>
        )}
      </div>

      {/* ── Footer: legend + pagination ── */}
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-2.5">

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <LegendItem status="done"    label="已通过" />
          <LegendItem status="active"  label="进行中" />
          <LegendItem status="shell"   label="卡点"   />
          <LegendItem status="error"   label="驳回"   />
          <LegendItem status="pending" label="未开始" />
        </div>

        {/* Pagination */}
        <div className="flex items-center gap-2.5 text-[11.5px] text-slate-500">
          <span>共 {rows.length} 个项目</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex size-6 items-center justify-center rounded border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
            >‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={[
                  'flex size-6 items-center justify-center rounded border text-[11px] transition-colors',
                  p === page
                    ? 'border-blue-500 bg-blue-500 font-semibold text-white'
                    : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600',
                ].join(' ')}
              >{p}</button>
            ))}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex size-6 items-center justify-center rounded border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
            >›</button>
          </div>
        </div>
      </div>
    </div>
  )
}
