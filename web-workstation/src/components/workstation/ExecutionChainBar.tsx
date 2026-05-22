import { pickString, type MockSnapshot } from '@/data/mockSnapshot'

export interface ExecutionChainBarProps {
  snapshot: MockSnapshot
}

/** 底部实时执行链 — 设计稿中的横向进度条 */
export function ExecutionChainBar({ snapshot }: ExecutionChainBarProps) {
  const pct = (5 / 7) * 100

  return (
    <div className="rounded-xl border border-slate-700/90 bg-[#1E293B] px-5 py-4 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.4)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-400">
            {pickString(snapshot.strings, 'material.execution_project')}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-white">
            {pickString(snapshot.strings, 'material.execution_stage_value')}
          </p>
        </div>
        <div className="flex flex-1 flex-col gap-2 sm:max-w-md sm:flex-none">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{pickString(snapshot.strings, 'material.execution_progress')}</span>
            <span className="text-blue-300/90">
              {pickString(snapshot.strings, 'material.execution_eta')}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.45)] transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
