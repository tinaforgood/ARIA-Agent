export default function ModuleOverview({ modules }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-[14px] font-semibold text-slate-900">模块内容总览</h3>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
        {modules.map((m) => {
          const Icon = m.icon
          return (
            <div
              key={m.id}
              className="group flex cursor-pointer items-start gap-3 rounded-xl p-2 transition-colors hover:bg-slate-50"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-500 transition-colors group-hover:bg-blue-100">
                <Icon className="size-4.5" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-slate-800">
                  {m.title}
                </div>
                {m.lines.map((line) => (
                  <div key={line} className="text-[11.5px] leading-snug text-slate-400">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
