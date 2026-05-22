import { ChevronRight, MapPin } from 'lucide-react'

const DOT_TONE = {
  emerald: 'bg-emerald-500',
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  blue: 'bg-blue-500',
  slate: 'bg-slate-300',
}

export default function RecentDynamics({ items }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-slate-900">近期项目动态</h3>
        <button
          type="button"
          className="text-[12px] font-medium text-blue-600 hover:text-blue-700"
        >
          全部项目 ›
        </button>
      </div>

      <ul className="flex flex-col">
        {items.map((it) => (
          <li
            key={it.id}
            className="group flex cursor-pointer items-center gap-3 rounded-lg px-1.5 py-2 transition-colors hover:bg-slate-50"
          >
            <span
              className={[
                'size-2 shrink-0 rounded-full',
                DOT_TONE[it.tone] ?? DOT_TONE.slate,
              ].join(' ')}
            />
            <div className="min-w-0 flex-1 truncate text-[13px] text-slate-700">
              {it.project}
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-500">
              <MapPin className="size-3 text-slate-400" strokeWidth={1.75} />
              {it.stage}
            </div>
            <div className="w-[68px] shrink-0 text-right text-[11.5px] text-slate-400">
              {it.time}
            </div>
            <ChevronRight
              className="size-3.5 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500"
              strokeWidth={1.75}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
