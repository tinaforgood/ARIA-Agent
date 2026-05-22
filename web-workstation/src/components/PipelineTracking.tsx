import { Check, ChevronRight, Circle, CircleDot, type LucideIcon } from 'lucide-react'

import {
  pickString,
  type MockSnapshot,
} from '@/data/mockSnapshot'

export interface PipelineTrackingProps {
  snapshot: MockSnapshot
}

export default function PipelineTracking({ snapshot }: PipelineTrackingProps) {
  const s = snapshot.strings
  const stages = snapshot.pipeline
  const doneCount = stages.filter((st) => st.status === 'done').length
  const pct = stages.length ? Math.round((doneCount / stages.length) * 100) : 0

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto bg-[#0F172A] p-6 lg:p-8">
      <header className="shrink-0 space-y-1 border-b border-white/10 pb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wider text-emerald-400/90">
          <span>全局视图</span>
          <ChevronRight className="size-3.5 opacity-60" aria-hidden strokeWidth={2} />
          <span className="text-slate-300">进度跟踪</span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
          {s.project_selector_value} · 流水线
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
          查看各 Agent 节点的完成顺序与当前卡点，与左侧「材料流转」页共享同一份快照数据。
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="rounded-xl border border-white/10 bg-[#1E293B]/80 px-4 py-3 shadow-sm backdrop-blur-sm">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">节点完成率</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-400">{pct}%</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#1E293B]/80 px-4 py-3 shadow-sm backdrop-blur-sm">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">已通过</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-100">
              {doneCount}<span className="text-lg text-slate-500">/</span>{stages.length}
            </p>
          </div>
        </div>
      </header>

      <section className="min-h-0 flex-1 rounded-2xl border border-white/10 bg-[#0D1B2A]/95 p-5 shadow-xl shadow-black/20 backdrop-blur-sm md:p-6">
        <h2 className="mb-6 text-[13px] font-semibold text-slate-200">七大智能体链路</h2>
        <ol className="space-y-3">
          {stages.map((st, idx) => {
            const label = pickString(s, st.label_key)
            const done = st.status === 'done'
            const active = st.status === 'active'
            const pending = st.status === 'pending'

            let Icon: LucideIcon = CircleDot
            if (done) Icon = Check
            else if (active) Icon = Circle

            let rowTone =
              'border-white/10 bg-[#141f30]/80 hover:border-emerald-500/20 hover:bg-[#172335]'
            let iconWrap = 'bg-slate-800 text-slate-500 ring-white/10'
            if (done) {
              iconWrap = 'bg-emerald-500/20 text-emerald-400 ring-emerald-400/35'
              rowTone = 'border-emerald-400/35 bg-emerald-500/10 hover:border-emerald-400/50'
            } else if (active) {
              iconWrap =
                'bg-blue-500/20 text-blue-300 ring-blue-400/40 shadow-[0_0_28px_-8px_rgba(96,165,250,0.55)] animate-pulse'
              rowTone = 'border-blue-400/35 bg-blue-500/15 hover:border-blue-400/50'
            } else if (pending) {
              iconWrap = 'bg-white/10 text-slate-500 ring-white/15'
            }

            return (
              <li
                key={st.id}
                className={[
                  'flex gap-4 rounded-xl border px-4 py-3.5 transition-all duration-200 ease-out md:gap-5',
                  rowTone,
                ].join(' ')}
              >
                <div className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-white/10 py-1 pr-4">
                  <span className="text-[10px] font-semibold uppercase tabular-nums text-slate-500">
                    第 {idx + 1} 步
                  </span>
                  <div
                    className={[
                      'flex size-10 items-center justify-center rounded-full ring-1 transition-transform duration-200',
                      iconWrap,
                    ].join(' ')}
                  >
                    <Icon
                      className="size-4"
                      strokeWidth={done ? 3 : 1.85}
                    />
                  </div>
                </div>

                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold tracking-wide text-slate-500">
                      {st.agent}
                    </span>
                    <span className="text-sm font-semibold text-slate-100">{label}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {done ? '已完成' : active ? '进行中 · Agent 产出可同步到材料流转' : '待发令'}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
