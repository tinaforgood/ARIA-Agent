/**
 * RightSidebar — 材料流转右栏（完全自包含）
 *
 * 包含两个内联子模块，还原自 commit 0066df5：
 *   1. MaterialSmartToDo — 填充背景卡片风格（danger / info 两种样式）
 *   2. RecentDynamics    — 近期项目动态列表
 */

import { AlertTriangle, FileCheck2, UploadCloud, CheckCircle2, Circle, ChevronRight, Sparkles } from 'lucide-react'
import RecentDynamics from './RecentDynamics'

// ─────────────────────────────────────────────────────────────
// MaterialSmartToDo  (原版 SmartToDo for MaterialFlowView)
// ─────────────────────────────────────────────────────────────
const SEVERITY_MAP = {
  danger: {
    cardBg:  'bg-red-50/60 border-red-100',
    iconBg:  'bg-red-100 text-red-500',
    icon:    AlertTriangle,
    title:   'text-red-700',
    chip:    'bg-red-500 text-white',
    button:  'bg-red-500 text-white hover:bg-red-600 shadow-sm shadow-red-500/30',
  },
  info: {
    cardBg:  'bg-blue-50/60 border-blue-100',
    iconBg:  'bg-blue-100 text-blue-500',
    icon:    FileCheck2,
    title:   'text-blue-700',
    chip:    'bg-blue-100 text-blue-700',
    button:  'border border-blue-200 bg-white text-blue-600 hover:bg-blue-50',
  },
}

function TodoCard({ todo, onAction }) {
  const tone = SEVERITY_MAP[todo.severity] ?? SEVERITY_MAP.info
  const Icon = tone.icon

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3.5 ${tone.cardBg}`}>
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone.iconBg}`}>
        <Icon className="size-5" strokeWidth={1.75} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[13.5px] font-semibold ${tone.title}`}>{todo.title}</span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tone.chip}`}>
            {todo.priorityLabel}
          </span>
        </div>
        <p className="mt-1 text-[12.5px] text-slate-700">{todo.summary}</p>
        {todo.detail && (
          <p className="mt-0.5 text-[11.5px] text-slate-500">{todo.detail}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onAction?.(todo)}
        className={`shrink-0 self-center rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${tone.button}`}
      >
        {todo.actionLabel}
      </button>
    </div>
  )
}

function MaterialSmartToDo({ todos = [], onAction, stpStraightThrough }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h3 className="text-[14px] font-semibold text-slate-900">智能待办</h3>
          <span className="text-[12px] text-slate-400">
            {stpStraightThrough ? '（本流程无需人工干预）' : '（需要人工干预）'}
          </span>
          {!stpStraightThrough && todos.length > 0 && (
            <span className="flex size-[18px] items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {todos.length}
            </span>
          )}
        </div>
        <button type="button" className="text-[12px] font-medium text-blue-600 hover:text-blue-700">
          全部待办 ›
        </button>
      </div>

      {stpStraightThrough ? (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3.5 py-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
            <FileCheck2 className="size-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-emerald-900">流程顺利完成，无需人工干预</p>
            <p className="mt-1 text-[12px] leading-snug text-emerald-800/90">
              未产生数据冲突或驳回补件任务，立项建议书已就绪，可直接导出正式版。
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {todos.map((t) => (
            <TodoCard key={t.id} todo={t} onAction={onAction} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// UploadGuidancePanel — 材料未上传完成时的引导面板
// ─────────────────────────────────────────────────────────────
function UploadGuidancePanel({ categories = [], onUpload }) {
  const requiredTotal  = categories.flatMap(c => c.items.filter(i => i.required !== false)).length
  const optionalTotal  = categories.flatMap(c => c.items.filter(i => i.required === false)).length

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">

      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-600 px-5 pt-4 pb-5">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <UploadCloud className="size-4 text-white" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-white leading-tight">上传材料后 AI 自动启动</h3>
            <p className="text-[11px] text-white/60 mt-0.5">请先完成材料上传，再由 Agent 接管</p>
          </div>
        </div>

        {/* Progress ring area */}
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/10 px-3.5 py-2.5">
          <div className="relative flex size-10 shrink-0 items-center justify-center">
            <svg className="absolute inset-0" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
              <circle cx="20" cy="20" r="16" fill="none" stroke="white" strokeWidth="4"
                strokeDasharray="100.5" strokeDashoffset="100.5"
                strokeLinecap="round" transform="rotate(-90 20 20)" />
            </svg>
            <span className="text-[11px] font-bold text-white">0%</span>
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-white">0 / {requiredTotal} 份必填材料</div>
            <div className="text-[11px] text-white/60">
              另有 {optionalTotal} 份选填材料可补充
            </div>
          </div>
        </div>
      </div>

      {/* ── Category checklist ── */}
      <div className="divide-y divide-slate-50">
        {categories.map((cat) => {
          const required = cat.items.filter(i => i.required !== false)
          const optional = cat.items.filter(i => i.required === false)
          return (
            <div key={cat.id} className="px-4 py-3">
              {/* Category header */}
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="flex size-[18px] shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-500">
                    {cat.index}
                  </span>
                  <span className="text-[12.5px] font-semibold text-slate-700">{cat.title}</span>
                  {cat.subtitle && (
                    <span className="text-[10px] text-slate-400">· {cat.subtitle}</span>
                  )}
                </div>
                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 border border-amber-100">
                  待上传
                </span>
              </div>

              {/* Items */}
              <div className="flex flex-col gap-1 pl-1">
                {required.map(item => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Circle className="size-3 shrink-0 text-slate-300" strokeWidth={2} />
                    <span className="truncate text-[11.5px] text-slate-600">{item.label}</span>
                    <span className="ml-auto shrink-0 rounded bg-red-50 px-1 py-px text-[9px] font-bold text-red-500">必填</span>
                  </div>
                ))}
                {optional.map(item => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Circle className="size-3 shrink-0 text-slate-200" strokeWidth={2} />
                    <span className="truncate text-[11.5px] text-slate-400">{item.label}</span>
                    <span className="ml-auto shrink-0 rounded bg-slate-50 px-1 py-px text-[9px] text-slate-400">选填</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── AI pipeline preview ── */}
      <div className="mx-4 mb-3 mt-1 rounded-xl border border-blue-100 bg-blue-50/60 px-3.5 py-2.5">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-blue-500" strokeWidth={2} />
          <span className="text-[11px] font-semibold text-blue-700">上传后将自动触发</span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {['需求梳理','竞品归并','预算测算','收益测算','合规核验','立项文书','审批反馈'].map((step, i, arr) => (
            <span key={step} className="flex items-center gap-1">
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                A{i+1} {step}
              </span>
              {i < arr.length - 1 && <ChevronRight className="size-2.5 text-blue-300 shrink-0" />}
            </span>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={onUpload}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-blue-600/30 active:scale-[.98]"
        >
          <UploadCloud className="size-4" strokeWidth={2.5} />
          开始上传材料
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────
export default function RightSidebar({
  todos = [],
  dynamics = [],
  onTodoAction,
  stpStraightThrough,
  isUploadPending = false,
  categories = [],
  onUpload,
}) {
  return (
    <aside className="flex w-[360px] shrink-0 flex-col gap-4 overflow-y-auto">
      {isUploadPending ? (
        <UploadGuidancePanel categories={categories} onUpload={onUpload} />
      ) : (
        <MaterialSmartToDo todos={todos} onAction={onTodoAction} stpStraightThrough={stpStraightThrough} />
      )}
      <RecentDynamics items={dynamics} />
    </aside>
  )
}
