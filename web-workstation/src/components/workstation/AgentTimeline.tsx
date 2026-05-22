import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { pickString, type MockSnapshot, type PipelineStage } from '@/data/mockSnapshot'

export interface AgentTimelineProps {
  snapshot: MockSnapshot
}

export function AgentTimeline({ snapshot }: AgentTimelineProps) {
  const stages = snapshot.pipeline
  const s = snapshot.strings

  return (
    /**
     * Design reference: white background band below the top navbar.
     * Project selector sits on the LEFT; 7 pill-shaped agent steps on the RIGHT.
     * Done → green pill with checkmark  |  Active → blue filled pill with pulse dot
     * Pending → gray outline pill with agent label
     */
    <div className="flex h-[52px] shrink-0 items-center justify-between gap-4 border-b border-slate-800/90 bg-[#0f172a] px-5">
      {/* Project selector */}
      <button
        type="button"
        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-900"
      >
        <span className="text-slate-500">{s.project_selector_label}：</span>
        <span className="max-w-[180px] truncate font-semibold text-slate-100">
          {s.project_selector_value}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-slate-500" />
      </button>

      {/* Pipeline steps */}
      <div className="flex items-center gap-0 overflow-x-auto">
        {stages.map((stage: PipelineStage, i: number) => {
          const label = pickString(s, stage.label_key)
          const done = stage.status === 'done'
          const active = stage.status === 'active'
          const pending = stage.status === 'pending'
          const isLast = i === stages.length - 1

          return (
            <div key={stage.id} className="flex items-center">
              {/* Pill */}
              <div
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                  done &&
                    'border-emerald-500/35 bg-emerald-500/15 text-emerald-300',
                  active &&
                    'pipeline-active-dot border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-900/40',
                  pending &&
                    'border-slate-600 bg-slate-900/50 text-slate-500',
                )}
              >
                {/* Status indicator */}
                {done && (
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                    <Check className="size-2.5 stroke-[3] text-white" />
                  </span>
                )}
                {active && (
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-white/25">
                    <span className="size-2 rounded-full bg-white animate-pulse" />
                  </span>
                )}
                {pending && (
                  <span className="size-4 shrink-0 rounded-full border-2 border-slate-600" />
                )}
                {stage.agent} {label}
              </div>

              {/* Arrow connector */}
              {!isLast && (
                <ChevronRight className="mx-0.5 size-3.5 shrink-0 text-slate-600" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
