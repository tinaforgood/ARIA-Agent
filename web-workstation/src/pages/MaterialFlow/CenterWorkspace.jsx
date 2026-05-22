import { Info, Pencil, Plus, Check, Loader2, AlertCircle, Download, Clock, RefreshCw } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import { pickString } from '@/data/mockSnapshot'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

// ── 状态展示配置 ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  created:    { label: '待处理',    dot: 'bg-slate-400',   text: 'text-slate-500',  bg: 'bg-slate-50'   },
  uploading:  { label: '上传中',    dot: 'bg-blue-400 animate-pulse', text: 'text-blue-600', bg: 'bg-blue-50' },
  ready:      { label: '材料就绪',  dot: 'bg-teal-400',    text: 'text-teal-600',   bg: 'bg-teal-50'    },
  ingesting:  { label: '文件解析中', dot: 'bg-amber-400 animate-pulse', text: 'text-amber-600', bg: 'bg-amber-50' },
  processing: { label: 'Agent 测算中', dot: 'bg-blue-500 animate-pulse', text: 'text-blue-700', bg: 'bg-blue-50' },
  done:       { label: '已完成',    dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  error:      { label: '出错',      dot: 'bg-red-500',     text: 'text-red-600',    bg: 'bg-red-50'     },
}

// 把 case 状态映射到 7 Agent 进度（0-7）
function agentProgress(status) {
  return { created:0, uploading:0, ready:0, ingesting:1, processing:4, done:7, error:0 }[status] ?? 0
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

// ── 真实案例列表组件 ─────────────────────────────────────────────────────────
function RealCasesList({ onOpenDrawer }) {
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const fetchCases = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cases`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setCases(data)
      setErr(null)
    } catch (e) {
      setErr('后端未连接')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCases()
    const timer = setInterval(fetchCases, 5000)  // 每5秒刷新
    return () => clearInterval(timer)
  }, [fetchCases])

  if (loading) return (
    <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
      <Loader2 className="size-3.5 animate-spin" />拉取案例列表…
    </div>
  )

  if (err) return (
    <div className="flex items-center gap-1.5 text-xs text-slate-400 py-1">
      <AlertCircle className="size-3.5 text-slate-300" />
      <span>后端未启动，实时案例不可用</span>
    </div>
  )

  if (cases.length === 0) return (
    <div className="py-2 text-xs text-slate-400">暂无案例，点击「新建立项论证任务」开始上传</div>
  )

  return (
    <div className="flex flex-col gap-2">
      {cases.map((c) => {
        const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.created
        const progress = agentProgress(c.status)
        const name = c.hospital_name || c.case_id.slice(0, 8)
        const isDone = c.status === 'done'
        const isRunning = ['ingesting','processing'].includes(c.status)

        return (
          <div key={c.case_id}
            className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3.5 py-2.5 shadow-sm hover:border-slate-200 transition-colors">

            {/* 状态圆点 */}
            <span className={cn('mt-0.5 size-2 shrink-0 rounded-full', cfg.dot)} />

            {/* 主要信息 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-slate-800 truncate">{name}</span>
                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', cfg.bg, cfg.text)}>
                  {cfg.label}
                </span>
              </div>
              {/* Agent 进度条 */}
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex gap-0.5">
                  {Array.from({length: 7}).map((_, i) => (
                    <div key={i} className={cn(
                      'h-1 w-5 rounded-full transition-colors',
                      i < progress ? 'bg-blue-500' : 'bg-slate-100'
                    )} />
                  ))}
                </div>
                <span className="text-[10px] text-slate-400">{progress}/7 Agent</span>
                {isRunning && <Loader2 className="size-3 animate-spin text-blue-400" />}
              </div>
            </div>

            {/* 时间 */}
            <div className="flex shrink-0 items-center gap-1 text-[10.5px] text-slate-400">
              <Clock className="size-3" />
              {fmtDate(c.created_at)}
            </div>

            {/* 操作 */}
            {isDone ? (
              <a href={`${API_BASE}/api/cases/${c.case_id}/document`}
                target="_blank" rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600 transition-colors shadow-sm">
                <Download className="size-3" strokeWidth={2.5} />建议书
              </a>
            ) : isRunning ? (
              <span className="shrink-0 text-[10.5px] text-blue-500 font-medium">运行中…</span>
            ) : (
              <button type="button" onClick={onOpenDrawer}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                继续
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

const OVERVIEW_ROW_ORDER = ['row_charge', 'row_volume', 'row_insurance', 'row_years', 'row_revenue']

/**
 * @param {{
 *   snapshot: import('@/data/mockSnapshot').MockSnapshot
 *   rows: import('@/data/mockSnapshot').UiMetricRow[]
 *   displayValues: Record<string, string>
 *   chargeResolved: boolean
 *   humanLoop: 'confirmed' | 'pending'
 *   onHumanLoopChange: (v: 'confirmed' | 'pending') => void
 *   onEditMetric: (rowId: string) => void
 * }} props
 */
export function CenterWorkspace({
  snapshot,
  rows,
  displayValues,
  chargeResolved,
  humanLoop,
  onHumanLoopChange,
  onEditMetric,
  onOpenDrawer,
}) {
  const s = snapshot.strings
  const m = s.material
  const w = s.workstation
  const [dragOver, setDragOver] = useState(false)

  const rowById = Object.fromEntries(rows.map((r) => [r.id, r]))

  const formatDisplay = (row) => {
    const raw = displayValues[row.display_value_key] ?? row.conflictable?.value ?? '—'
    if (row.unit_key) return `${raw}${pickString(s, row.unit_key)}`
    return raw
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-white">
      <div className="space-y-4 p-4 pb-6">
        {/* Workspace header */}
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {w.current_workspace_title}
              <span className="ml-1 font-semibold text-blue-600">{w.current_workspace_stage}</span>
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-gray-500">{w.workspace_intro}</p>
          </div>
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
          >
            <Info className="size-3.5" />
            {w.node_doc}
          </button>
        </div>

        {/* Node guidance */}
        <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-xs leading-relaxed text-blue-900 shadow-sm">
          {w.workspace_intro}
        </div>

        {/* Key metrics — horizontal */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              {m.key_overview}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {OVERVIEW_ROW_ORDER.map((id) => {
              const row = rowById[id]
              if (!row) return null
              const isCharge = id === 'row_charge'
              const isRevenue = id === 'row_revenue'
              const conflictActive = isCharge && row.conflictable?.conflict && !chargeResolved

              return (
                <div
                  key={id}
                  className={cn(
                    'flex flex-col gap-2 rounded-xl border p-3 shadow-sm',
                    conflictActive ? 'border-red-200 bg-red-50/50' : 'border-gray-100 bg-gray-50/40',
                  )}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-[11px] font-medium leading-snug text-gray-500">
                      {pickString(s, row.label_key)}
                    </span>
                    {row.editable ? (
                      <button
                        type="button"
                        onClick={() => onEditMetric(row.id)}
                        className="shrink-0 rounded-lg p-1 text-blue-600 transition-colors hover:bg-blue-50"
                        aria-label="编辑"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                  {conflictActive ? (
                    <div className="flex flex-wrap items-center gap-1 text-sm font-bold text-red-600">
                      <span>¥430/次</span>
                      <span className="text-[11px] font-normal text-red-400">vs</span>
                      <span>¥460/次</span>
                    </div>
                  ) : (
                    <p
                      className={cn(
                        'text-lg font-semibold tracking-tight text-gray-900',
                        isRevenue && 'text-emerald-600',
                      )}
                    >
                      {formatDisplay(row)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Human checkpoint */}
        <div className="rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-100/90 via-orange-50/90 to-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-amber-900">{w.human_loop_title}</p>
            <span className="text-[11px] font-medium text-amber-800/80">{w.human_loop_prompt}</span>
          </div>
          <RadioGroup
            value={humanLoop}
            onValueChange={(v) => onHumanLoopChange(v)}
            className="flex flex-wrap gap-4"
          >
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/60 bg-white/70 px-3 py-2 shadow-sm">
              <RadioGroupItem value="confirmed" id="human-confirmed" />
              <span className="text-sm font-medium text-gray-800">{w.human_confirmed}</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/60 bg-white/70 px-3 py-2 shadow-sm">
              <RadioGroupItem value="pending" id="human-pending" />
              <span className="text-sm font-medium text-gray-800">{w.human_pending}</span>
            </label>
          </RadioGroup>
        </div>

        {/* ── 真实案例列表 ─────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">立项案例</h3>
            <button type="button" onClick={onOpenDrawer}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm">
              <Plus className="size-3" strokeWidth={3} />新建案例
            </button>
          </div>
          <RealCasesList onOpenDrawer={onOpenDrawer} />
        </div>

        {/* Upload */}
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div
            role="presentation"
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
            }}
            className={cn(
              'relative flex min-h-[168px] cursor-pointer flex-col items-center justify-center gap-3 border-b border-dashed border-gray-200 px-6 py-10 transition-colors',
              dragOver ? 'border-blue-300 bg-blue-50/50' : 'bg-gray-50/30 hover:bg-blue-50/20',
            )}
          >
            <div className="flex size-14 items-center justify-center rounded-full bg-blue-600 shadow-lg shadow-blue-600/25">
              <Plus className="size-7 text-white" strokeWidth={2.5} />
            </div>
            <p className="text-sm font-semibold text-blue-600">{w.upload_cta}</p>
            <p className="text-center text-[11px] text-gray-400">{m.upload_formats_short}</p>
          </div>

          <div className="space-y-2 p-4">
            <p className="text-xs font-semibold text-gray-700">
              {m.uploaded_files_count_tpl.replace('{n}', String(snapshot.material_demo_uploads.length))}
            </p>
            <ul className="space-y-2">
              {snapshot.material_demo_uploads.map((f) => (
                <li
                  key={f.name}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5 shadow-sm"
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                    <Check className="size-4 stroke-[3]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-gray-900">{f.name}</p>
                    <p className="text-[11px] text-gray-400">{f.size}</p>
                  </div>
                  <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-gray-500 ring-1 ring-gray-100">
                    {f.ext}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-3 shadow-sm">
          <button
            type="button"
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700"
          >
            {w.action_upload}
          </button>
          <button
            type="button"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:border-gray-300"
          >
            {w.action_supplement}
          </button>
          <button
            type="button"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:border-gray-300"
          >
            {w.action_advance}
          </button>
          <button
            type="button"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:border-gray-300"
          >
            {w.action_export_list}
          </button>
          <button
            type="button"
            className="ml-auto rounded-xl px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50"
          >
            {w.action_view_flow}
          </button>
        </div>
      </div>
    </section>
  )
}
