import type { MouseEvent } from 'react'
import { useState } from 'react'
import {
  AlertTriangle,
  Info,
  Pencil,
  ShieldCheck,
  Upload,
  RefreshCw,
  GitPullRequestArrow,
  FileDown,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  pickString,
  type MetricUiStatus,
  type MockSnapshot,
  type UiMetricRow,
} from '@/data/mockSnapshot'

import { ExecutionChainBar } from './ExecutionChainBar'
import { MaterialUploadHero } from './MaterialUploadHero'

/* ─────────────────────────────────────────────
   Badge palette
───────────────────────────────────────────── */
const STATUS: Record<MetricUiStatus, { row: string; badge: string; dot: string; label: string }> = {
  conflict: {
    row:   'bg-[#FEF2F2]',
    badge: 'border-red-200 bg-red-50 text-red-600',
    dot:   'bg-red-500',
    label: '数据冲突',
  },
  hypothesis: {
    row:   'bg-[#EDE9FE]/30',
    badge: 'border-violet-200 bg-violet-50 text-violet-600',
    dot:   'bg-violet-400',
    label: '假设值',
  },
  verified: {
    row:   'bg-[#D1FAE5]/30',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-600',
    dot:   'bg-emerald-500',
    label: '已核验',
  },
}

function MetricBadge({ status }: { status: MetricUiStatus }) {
  const p = STATUS[status]
  return (
    <span
      className={cn(
        'badge-transition inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        p.badge,
      )}
    >
      <span className={cn('size-1.5 rounded-full', p.dot)} />
      {status === 'verified' && <ShieldCheck className="size-3" />}
      {status === 'conflict' && <AlertTriangle className="size-3" />}
      {p.label}
    </span>
  )
}

/* ─────────────────────────────────────────────
   Conflict Popover
───────────────────────────────────────────── */
interface ConflictPopoverProps {
  onConfirm460: () => void
  onClose: () => void
}
function ConflictPopover({ onConfirm460, onClose }: ConflictPopoverProps) {
  return (
    <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-red-100 bg-white shadow-xl fade-in">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">选择正确收费标准</p>
          <p className="mt-0.5 text-xs text-gray-500">发现 2 个来源数值不一致，请人工确认</p>
        </div>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="size-3.5" />
        </button>
      </div>
      <div className="space-y-2 p-3">
        {[
          {
            val: '430元/次',
            label: 'user_upload',
            labelCls: 'bg-blue-50 text-blue-600',
            src: '2026年度万元以上设备预算申报论证表3.0T.docx',
            cat: '01_requirements',
          },
          {
            val: '460元/次',
            label: 'agent_corpus',
            labelCls: 'bg-gray-100 text-gray-600',
            src: '设备申购报告表2022版-3T.doc',
            cat: 'a_requirements',
          },
        ].map((cv, i) => (
          <button
            key={i}
            type="button"
            onClick={() => { onConfirm460(); onClose() }}
            className="group flex w-full items-start gap-3 rounded-lg border border-gray-100 p-3 text-left transition-all hover:border-blue-300 hover:bg-blue-50"
          >
            <div className="mt-0.5 size-4 shrink-0 rounded-full border-2 border-gray-300 group-hover:border-blue-500" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-bold text-gray-900">{cv.val}</span>
                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', cv.labelCls)}>
                  {cv.label}
                </span>
              </div>
              <p className="truncate text-xs text-gray-500">来源：{cv.src}</p>
              <p className="text-xs text-gray-400">类别：{cv.cat}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="rounded-b-xl border-t border-amber-100 bg-amber-50 px-4 py-2">
        <p className="text-xs text-amber-700">
          💡 建议优先选择 user_upload 来源（当次申报权威数据）
        </p>
      </div>
    </div>
  )
}


/* ─────────────────────────────────────────────
   Props
───────────────────────────────────────────── */
export interface DataTableProps {
  snapshot:           MockSnapshot
  rows:               UiMetricRow[]
  displayValues:      Record<string, string>
  selectedRowId:      string | null
  onSelectRow:        (id: string) => void
  chargeResolved:     boolean
  onConfirm460:       () => void
  humanLoop:          'confirmed' | 'pending'
  onHumanLoopChange:  (v: 'confirmed' | 'pending') => void
}

/* ─────────────────────────────────────────────
   Main component
───────────────────────────────────────────── */
export function DataTable({
  snapshot,
  rows,
  displayValues,
  selectedRowId,
  onSelectRow,
  chargeResolved,
  onConfirm460,
  humanLoop,
  onHumanLoopChange,
}: DataTableProps) {
  const s = snapshot.strings
  const [openConflict, setOpenConflict] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const conflictRow = rows.find((r) => r.id === 'row_charge')

  const formatDisplay = (row: UiMetricRow): string => {
    const raw = displayValues[row.display_value_key] ?? row.conflictable?.value ?? '—'
    if (row.unit_key) return `${raw}${pickString(s, row.unit_key)}`
    return raw
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#0F172A]">
      <div className="flex-1 space-y-4 p-4 pb-6">
        <MaterialUploadHero
          snapshot={snapshot}
          files={snapshot.material_demo_uploads}
          dragOver={dragOver}
          setDragOver={setDragOver}
        />

        {/* ── Workspace header ── */}
        <div className="flex items-center justify-between rounded-xl border border-slate-700/80 bg-[#1E293B] px-4 py-3 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              {s.workstation.current_workspace_title}
              <span className="ml-2 font-normal text-blue-400">
                {s.workstation.current_workspace_stage}
              </span>
            </h2>
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-blue-400 transition-colors hover:text-blue-300"
          >
            <Info className="size-3.5" />
            {s.workstation.node_doc}
          </button>
        </div>

        {/* ── Description ── */}
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/35 px-4 py-2.5 text-xs leading-relaxed text-slate-400">
          {s.workstation.workspace_intro}
        </div>

        {/* ── Metrics overview ── */}
        <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-[#1E293B] shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-700/70 px-4 py-2.5">
            <span className="text-sm font-semibold text-slate-200">
              {pickString(s, 'material.key_overview')}
            </span>
            {conflictRow?.ui_status === 'conflict' && !chargeResolved ? (
              <MetricBadge status="conflict" />
            ) : (
              <MetricBadge status="verified" />
            )}
          </div>

          <table className="w-full">
            <tbody>
              <tr className="bg-slate-800/50">
                {rows.map((row) => (
                  <td
                    key={row.id}
                    className="border-b border-slate-700/60 px-3 py-2 text-center text-[11px] font-medium text-slate-400"
                  >
                    {pickString(s, row.label_key)}
                  </td>
                ))}
              </tr>
              <tr>
                {rows.map((row) => {
                  const pal = STATUS[row.ui_status]
                  const display = formatDisplay(row)
                  const isConflict =
                    row.id === 'row_charge' && row.ui_status === 'conflict'
                  return (
                    <td
                      key={row.id}
                      onClick={() => onSelectRow(row.id)}
                      className={cn(
                        'cursor-pointer border-b border-slate-700/60 px-3 py-3 text-center transition-colors',
                        selectedRowId === row.id
                          ? 'ring-2 ring-inset ring-blue-500/45'
                          : '',
                        pal.row,
                        'hover:brightness-[0.98]',
                      )}
                    >
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold text-slate-900">
                            {display}
                          </span>
                          {row.editable && (
                            <button
                              type="button"
                              onClick={(e: MouseEvent) => e.stopPropagation()}
                              className="rounded p-0.5 opacity-50 hover:opacity-100"
                            >
                              <Pencil className="size-3 text-slate-600" />
                            </button>
                          )}
                        </div>
                        {row.note_key &&
                          row.id === 'row_charge' &&
                          !chargeResolved && (
                            <p className="max-w-[140px] text-center text-[10px] leading-tight text-red-600">
                              {pickString(s, row.note_key)}
                            </p>
                          )}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e: MouseEvent) => {
                              e.stopPropagation()
                              if (isConflict && !chargeResolved)
                                setOpenConflict((v) => !v)
                            }}
                          >
                            <MetricBadge status={row.ui_status} />
                          </button>
                          {isConflict && openConflict && !chargeResolved && (
                            <ConflictPopover
                              onConfirm460={() => {
                                onConfirm460()
                                setOpenConflict(false)
                              }}
                              onClose={() => setOpenConflict(false)}
                            />
                          )}
                        </div>
                      </div>
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>

          {conflictRow?.ui_status === 'conflict' && !chargeResolved && (
            <div className="flex items-center gap-2 border-t border-red-200/40 bg-red-950/30 px-4 py-2.5">
              <AlertTriangle className="size-4 shrink-0 text-red-400" />
              <p className="flex-1 text-xs text-red-200">
                {s.workstation.conflict_banner_charge}
              </p>
            </div>
          )}
        </div>

        {/* ── Human-in-the-loop ── */}
        <div className="rounded-xl border border-slate-700/80 bg-[#1E293B] p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
              <span className="text-sm">👤</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-100">
                {s.workstation.human_loop_title}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {s.workstation.human_loop_prompt}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              {(['confirmed', 'pending'] as const).map((val) => (
                <label
                  key={val}
                  className="flex cursor-pointer items-center gap-1.5"
                >
                  <button
                    type="button"
                    onClick={() => onHumanLoopChange(val)}
                    className={cn(
                      'flex size-4 items-center justify-center rounded-full border-2 transition-colors',
                      humanLoop === val && val === 'confirmed'
                        ? 'border-emerald-500 bg-emerald-500'
                        : humanLoop === val && val === 'pending'
                          ? 'border-amber-500 bg-amber-500'
                          : 'border-slate-500',
                    )}
                  >
                    {humanLoop === val && (
                      <span className="size-2 rounded-full bg-white" />
                    )}
                  </button>
                  <span
                    className={cn(
                      'text-xs font-medium',
                      val === 'confirmed'
                        ? 'text-emerald-400'
                        : 'text-amber-400',
                    )}
                  >
                    {val === 'confirmed'
                      ? s.workstation.human_confirmed
                      : s.workstation.human_pending}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <ExecutionChainBar snapshot={snapshot} />
      </div>

      {/* ── Bottom action bar ── */}
      <div className="flex shrink-0 items-center gap-2 border-t border-slate-800 bg-[#0b1120] px-4 py-3">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-600"
        >
          <Upload className="size-3.5" />
          {s.workstation.action_upload}
        </button>
        {[
          { icon: RefreshCw, label: s.workstation.action_supplement },
          { icon: GitPullRequestArrow, label: s.workstation.action_advance },
          { icon: FileDown, label: s.workstation.action_export_list },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800"
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
        <button
          type="button"
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
        >
          <Info className="size-3.5" />
          {s.workstation.action_view_flow}
        </button>
      </div>
    </div>
  )
}
