/**
 * RationalityComparisonTable.jsx
 * 申康采购合理性判定 — 多院横向对比表
 *
 * Props:
 *   rows        {Array}   pipeline rows（含 rationality: { verdict, dims, detail? } | null）
 *   realCaseData {object} 来自后端 /rationality 的真实数据（可选，覆盖 realRow 的展开内容）
 *   useMock     {bool}    是否显示「演示数据」标签
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, Clock, CheckCircle2, AlertCircle, XCircle, RefreshCw } from 'lucide-react'
import RationalityGatePanel from './RationalityGatePanel'

// ── 配置 ──────────────────────────────────────────────────────────────────────
const DIM_KEYS   = ['workload', 'waiting_time', 'positive_rate', 'device_age']
const DIM_LABELS = ['工作负荷', '候检时间', '阳性率', '成新率']

const DOT = {
  green:   'bg-emerald-500',
  yellow:  'bg-amber-400',
  red:     'bg-red-500',
  unknown: 'bg-slate-300',
}

const VERDICT_BADGE = {
  pass:           { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2, label: '通过'     },
  conditional:    { cls: 'bg-amber-50  text-amber-700  border-amber-200',    icon: AlertCircle,  label: '条件通过' },
  reject:         { cls: 'bg-red-50    text-red-600    border-red-200',      icon: XCircle,      label: '暂缓立项' },
  exempt_renewal: { cls: 'bg-blue-50   text-blue-700   border-blue-200',     icon: RefreshCw,    label: '更新豁免' },
}

// ── 单行组件 ─────────────────────────────────────────────────────────────────
function CompRow({ row, isExpanded, onToggle, detailData }) {
  const r       = row.rationality
  const pending = !r || !r.verdict
  const badge   = r?.verdict ? VERDICT_BADGE[r.verdict] : null

  return (
    <div>
      {/* ─── 主行 ─── */}
      <div
        className={[
          'flex items-center gap-3 px-5 py-3.5 transition-colors',
          pending ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50',
        ].join(' ')}
        onClick={() => !pending && onToggle(row.id)}
      >
        {/* 项目名称 + 科室 */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-slate-800 leading-tight truncate">{row.name}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{row.dept}　·　{row.type}</p>
        </div>

        {/* 四维交通灯点 */}
        <div className="flex items-center gap-5 shrink-0">
          {DIM_KEYS.map((k) => {
            const score = r?.dims?.[k]
            return (
              <div key={k} className="flex flex-col items-center gap-1 w-10">
                {score
                  ? <span className={`w-3 h-3 rounded-full ${DOT[score] ?? DOT.unknown}`} />
                  : <span className="text-[11px] text-slate-300">—</span>
                }
              </div>
            )
          })}
        </div>

        {/* 综合判定徽章 */}
        <div className="w-[7.5rem] flex justify-center shrink-0">
          {pending
            ? (
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Clock size={11} />待判定
              </span>
            )
            : (() => {
                const Icon = badge?.icon
                return (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${badge?.cls}`}>
                    {Icon && <Icon size={11} strokeWidth={2.5} />}
                    {badge?.label}
                  </span>
                )
              })()
          }
        </div>

        {/* 展开箭头 */}
        <div className="w-5 flex justify-center text-slate-400 shrink-0">
          {!pending && (isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
        </div>
      </div>

      {/* ─── 展开详情 ─── */}
      {isExpanded && (
        <div className="px-5 pb-5 border-t border-slate-100 bg-slate-50/40">
          <RationalityGatePanel
            data={detailData ?? r?.detail ?? null}
            className="mt-4"
          />
        </div>
      )}
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────────
export default function RationalityComparisonTable({ rows = [], realCaseData = null, useMock = true }) {
  const [expandedId, setExpandedId] = useState(null)

  const toggle = (id) =>
    setExpandedId((prev) => (prev === id ? null : id))

  // 有 rationality 数据的行才参与对比（过滤掉 p5 这类尚未到达节点的）
  const activeRows  = rows.filter((r) => r.rationality?.verdict)
  const pendingRows = rows.filter((r) => !r.rationality?.verdict && !r._isReal)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">

      {/* ── 表头 ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-2 bg-slate-50/80 border-b border-slate-100">
        {/* 左：标题占位 */}
        <div className="flex-1" />

        {/* 四维列标签 */}
        <div className="flex items-center gap-5 shrink-0">
          {DIM_LABELS.map((l) => (
            <p key={l} className="w-10 text-center text-[11px] font-semibold text-slate-500">
              {l}
            </p>
          ))}
        </div>

        {/* 综合判定列标签 */}
        <p className="w-[7.5rem] text-center text-[11px] font-semibold text-slate-500 shrink-0">
          综合判定
        </p>

        {/* 箭头列占位 */}
        <div className="w-5 shrink-0" />
      </div>

      {/* ── 已判定行 ───────────────────────────────────────────────────────── */}
      {activeRows.map((row, i) => (
        <div key={row.id} className={i < activeRows.length - 1 || pendingRows.length > 0 ? 'border-b border-slate-100' : ''}>
          <CompRow
            row={row}
            isExpanded={expandedId === row.id}
            onToggle={toggle}
            detailData={row._isReal ? realCaseData : (row.rationality?.detail ?? null)}
          />
        </div>
      ))}

      {/* ── 待判定行（折叠显示，置灰） ────────────────────────────────────── */}
      {pendingRows.length > 0 && (
        <div className="px-5 py-2.5 flex flex-wrap gap-2 bg-slate-50/50">
          <span className="text-[11px] text-slate-400 mr-1 self-center">待判定：</span>
          {pendingRows.map((row) => (
            <span
              key={row.id}
              className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 flex items-center gap-1"
            >
              <Clock size={10} />
              {row.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
