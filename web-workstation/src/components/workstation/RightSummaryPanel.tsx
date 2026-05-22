import {
  BarChart3,
  FileText,
  LayoutDashboard,
  Shuffle,
  Activity,
  Settings,
} from 'lucide-react'

const PIPELINE_STATUSES = ['done', 'done', 'done', 'active', 'pending', 'pending', 'pending']

const REMINDERS = [
  { level: 'red',    text: '请在 2 个工作日内确认人工确认项',    time: '今天 10:30' },
  { level: 'orange', text: 'A5 合规核验节点预计 3 天后超期',      time: '6月24日' },
  { level: 'blue',   text: '医保报销比例说明文件可补充上传',       time: '6月22日' },
]

const MODULES = [
  {
    icon: LayoutDashboard,
    label: '工作台',
    sub: '今日待办，风险提醒\n最近操作记录',
    color: '#3B82F6',
    bg: '#EFF6FF',
    active: false,
  },
  {
    icon: Shuffle,
    label: '材料流转',
    sub: '资料收集、补件上传\n节点流转、材料清单',
    color: '#10B981',
    bg: '#ECFDF5',
    active: true,
  },
  {
    icon: Activity,
    label: '进度跟踪',
    sub: '时间轴视图，责任人\n节点完成率统计',
    color: '#8B5CF6',
    bg: '#F5F3FF',
    active: false,
  },
  {
    icon: BarChart3,
    label: '统计分析',
    sub: '项目数量、周期分析\n完整率、环节耗时',
    color: '#F59E0B',
    bg: '#FFFBEB',
    active: false,
  },
  {
    icon: FileText,
    label: '文档中心',
    sub: '模板管理、版本记录\n全文检索、权限控制',
    color: '#6B7280',
    bg: '#F9FAFB',
    active: false,
  },
  {
    icon: Settings,
    label: '系统设置',
    sub: '角色权限、审批流\n字段规则、基础配置',
    color: '#6B7280',
    bg: '#F9FAFB',
    active: false,
  },
]

const dotColor: Record<string, string> = {
  red: 'bg-red-500',
  orange: 'bg-orange-400',
  blue: 'bg-blue-400',
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      <circle cx="44" cy="44" r={r} fill="none" stroke="#334155" strokeWidth="8" />
      <circle
        cx="44" cy="44" r={r}
        fill="none" stroke="#3B82F6" strokeWidth="8"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 44 44)"
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }}
      />
      <text
        x="44" y="44"
        textAnchor="middle" dominantBaseline="middle"
        fontSize="16" fontWeight="700" fill="#f1f5f9"
      >
        {pct}%
      </text>
    </svg>
  )
}

export function RightSummaryPanel() {
  return (
    <aside className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-l border-slate-800 bg-[#0b1120] p-4">
      {/* Progress Card */}
      <div className="rounded-xl border border-slate-700/80 bg-[#1E293B] p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold text-slate-400">整体进度</p>
        <div className="flex items-center gap-4">
          <ProgressRing pct={52} />
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <p className="text-[10px] text-slate-500">当前节点</p>
              <p className="text-xs font-semibold text-blue-400">● A4 收益测算</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500">下一步</p>
              <p className="text-xs font-medium text-slate-300">○ A5 合规核验</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500">预计完成时间</p>
              <p className="text-xs font-medium text-slate-200">2024-06-30</p>
            </div>
          </div>
        </div>

        {/* Mini pipeline */}
        <div className="mt-3 border-t border-slate-700/70 pt-3 text-center">
          <p className="text-xs text-slate-400">
            流程已进行 <span className="font-bold text-slate-100">4</span> / 7 节点
          </p>
          <div className="mt-2 flex gap-1">
            {PIPELINE_STATUSES.map((st, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  st === 'done'
                    ? 'bg-emerald-500'
                    : st === 'active'
                      ? 'bg-blue-500'
                      : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Reminders */}
      <div className="rounded-xl border border-slate-700/80 bg-[#1E293B] p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200">
            提醒事项 ({REMINDERS.length})
          </span>
          <button
            type="button"
            className="text-[10px] text-blue-400 transition-colors hover:text-blue-300"
          >
            查看全部 →
          </button>
        </div>
        <div className="space-y-2.5">
          {REMINDERS.map((r, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span
                className={`mt-1 size-2 shrink-0 rounded-full ${dotColor[r.level]}`}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={`text-xs leading-snug ${
                    r.level === 'red'
                      ? 'font-medium text-red-300'
                      : 'text-slate-300'
                  }`}
                >
                  {r.text}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">{r.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Module Overview */}
      <div className="rounded-xl border border-slate-700/80 bg-[#1E293B] p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold text-slate-200">模块内容总览</p>
        <div className="grid grid-cols-2 gap-2">
          {MODULES.map((m) => {
            const IconComp = m.icon
            return (
              <button
                key={m.label}
                type="button"
                className={`rounded-xl border p-3 text-left transition-all hover:shadow-md ${
                  m.active
                    ? 'border-emerald-500/50 bg-emerald-500/10 shadow-sm'
                    : 'border-slate-700/80 bg-slate-900/40 hover:border-slate-600'
                }`}
              >
                <div
                  className="mb-2 flex size-7 items-center justify-center rounded-lg bg-slate-800/80"
                >
                  <IconComp
                    className="size-[15px]"
                    style={{ color: m.color }}
                    strokeWidth={2}
                  />
                </div>
                <p className="text-xs font-semibold text-slate-100">{m.label}</p>
                <p className="mt-0.5 whitespace-pre-line text-[10px] leading-snug text-slate-500">
                  {m.sub}
                </p>
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
