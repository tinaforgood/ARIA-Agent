/**
 * SmartToDo — Section 2: 智能待办与干预中心（工作台的灵魂）
 *
 * Each todo card has a left-accent border, icon, priority chip, summary,
 * timestamp, and action button. Four severity levels:
 *   danger   → red    (数据冲突待裁决)
 *   warning  → amber  (驳回与回溯待处理)
 *   caution  → violet (核心假设待背书)
 *   normal   → blue   (终审与建议书导出)
 */

import {
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react'

const SEVERITY_MAP = {
  success: {
    border:    'border-l-emerald-500',
    bg:        'bg-emerald-50/40',
    iconWrap:  'bg-emerald-100 text-emerald-600',
    icon:      CheckCircle2,
    titleCls:  'text-emerald-900',
    chipCls:   'bg-emerald-100 text-emerald-800',
    btnCls:    'hidden',
  },
  danger: {
    border:    'border-l-red-500',
    bg:        'bg-red-50/50',
    iconWrap:  'bg-red-100 text-red-500',
    icon:      AlertTriangle,
    titleCls:  'text-red-700',
    chipCls:   'bg-red-100 text-red-700',
    btnCls:    'bg-red-500 text-white shadow-sm shadow-red-500/30 hover:bg-red-600',
  },
  warning: {
    border:    'border-l-amber-500',
    bg:        'bg-amber-50/40',
    iconWrap:  'bg-amber-100 text-amber-500',
    icon:      AlertCircle,
    titleCls:  'text-amber-700',
    chipCls:   'bg-amber-100 text-amber-700',
    btnCls:    'border border-amber-300 text-amber-700 bg-white hover:bg-amber-50',
  },
  caution: {
    border:    'border-l-violet-500',
    bg:        'bg-violet-50/40',
    iconWrap:  'bg-violet-100 text-violet-500',
    icon:      ShieldAlert,
    titleCls:  'text-violet-700',
    chipCls:   'bg-violet-100 text-violet-700',
    btnCls:    'border border-violet-200 text-violet-600 bg-white hover:bg-violet-50',
  },
  normal: {
    border:    'border-l-blue-400',
    bg:        'bg-blue-50/30',
    iconWrap:  'bg-blue-100 text-blue-500',
    icon:      CheckCircle2,
    titleCls:  'text-slate-800',
    chipCls:   'bg-slate-100 text-slate-600',
    btnCls:    'border border-blue-200 text-blue-600 bg-white hover:bg-blue-50',
  },
}

function TodoCard({ todo, onAction }) {
  const tone = SEVERITY_MAP[todo.severity] ?? SEVERITY_MAP.normal
  const Icon = tone.icon
  const hideAction = todo.hideAction || todo.severity === 'success' || !todo.actionLabel

  return (
    <div
      className={[
        'relative flex items-start gap-3 rounded-xl border-l-[3px] bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md',
        tone.border,
        tone.bg,
      ].join(' ')}
    >
      {/* Icon */}
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone.iconWrap}`}>
        <Icon className="size-5" strokeWidth={1.75} />
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        {/* Title row */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`text-[13px] font-semibold leading-tight ${tone.titleCls}`}>
            {todo.title}
          </span>
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${tone.chipCls}`}>
            {todo.priorityLabel}
          </span>
        </div>
        {/* Summary */}
        <p className="mt-1.5 text-[12px] leading-snug text-slate-600">{todo.summary}</p>
      </div>

      {/* Right: timestamp + button */}
      <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
        <span className="whitespace-nowrap text-[11px] text-slate-400">{todo.time}</span>
        {!hideAction && (
          <button
            type="button"
            onClick={() => onAction?.(todo)}
            className={[
              'whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors',
              tone.btnCls,
            ].join(' ')}
          >
            {todo.actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}

export default function SmartToDo({ todos, onAction }) {
  const hasUrgent = todos.some((t) => t.severity === 'danger')
  const allDone   = todos.length === 1 && todos[0]?.severity === 'success'

  const headerGradient = allDone
    ? 'from-emerald-500 to-teal-500'
    : hasUrgent
      ? 'from-red-500 to-orange-500'
      : 'from-blue-600 to-indigo-600'

  const badgeBg = allDone ? 'bg-emerald-500' : 'bg-red-500'

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">

      {/* ── Section header ── */}
      <div className={`bg-gradient-to-r ${headerGradient} px-5 py-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[14px] font-semibold text-white leading-tight">
              智能待办与干预中心
            </h2>
            {todos.length > 0 && !allDone && (
              <span className={`flex size-[18px] items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white/30 ${badgeBg}`}>
                {todos.length}
              </span>
            )}
          </div>
          <button
            type="button"
            className="whitespace-nowrap text-[12px] font-medium text-white/80 hover:text-white transition-colors"
          >
            查看全部 ({todos.length > 0 ? `${todos.length * 3}` : '0'}) ›
          </button>
        </div>
        <p className="mt-0.5 text-[11px] text-white/60">需要你处理的关键节点</p>
      </div>

      {/* ── Todo list ── */}
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4">
        {todos.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-[13px] text-slate-400">
            暂无待办项 🎉
          </div>
        ) : (
          todos.map((t) => (
            <TodoCard key={t.id} todo={t} onAction={onAction} />
          ))
        )}
      </div>

    </div>
  )
}
