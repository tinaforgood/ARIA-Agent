import {
  Activity,
  BarChart3,
  FileText,
  LayoutDashboard,
  Settings,
  Shuffle,
} from 'lucide-react'

import { ProgressRing } from '@/components/ui/ProgressRing'
import { pickString } from '@/data/mockSnapshot'

const REMINDERS = [
  { level: 'red', text: '请在 2 个工作日内确认人工确认项', time: '今天 10:30' },
  { level: 'orange', text: 'A5 合规核验节点预计 3 天后超期', time: '6月24日' },
  { level: 'blue', text: '医保报销比例说明文件可补充上传', time: '6月22日' },
]

const MODULES = [
  {
    icon: LayoutDashboard,
    labelKey: 'nav.workbench',
    sub: '今日待办，风险提醒\n最近操作记录',
    color: '#2563EB',
    bg: '#EFF6FF',
    navId: 'workbench',
  },
  {
    icon: Shuffle,
    labelKey: 'nav.material_flow',
    sub: '资料收集、补件上传\n节点流转、材料清单',
    color: '#10B981',
    bg: '#ECFDF5',
    navId: 'material',
  },
  {
    icon: Activity,
    labelKey: 'nav.progress',
    sub: '时间轴视图，责任人\n节点完成率统计',
    color: '#8B5CF6',
    bg: '#F5F3FF',
    navId: 'progress',
  },
  {
    icon: BarChart3,
    labelKey: 'nav.stats',
    sub: '项目数量、周期分析\n完整率、环节耗时',
    color: '#F59E0B',
    bg: '#FFFBEB',
    navId: 'stats',
  },
  {
    icon: FileText,
    labelKey: 'nav.docs',
    sub: '模板管理、版本记录\n全文检索、权限控制',
    color: '#6B7280',
    bg: '#F9FAFB',
    navId: 'docs',
  },
  {
    icon: Settings,
    labelKey: 'nav.settings',
    sub: '角色权限、审批流\n字段规则、基础配置',
    color: '#6B7280',
    bg: '#F9FAFB',
    navId: 'settings',
  },
]

const dotColor = {
  red: 'bg-red-500',
  orange: 'bg-amber-400',
  blue: 'bg-blue-400',
}

/** @param {{ snapshot: import('@/data/mockSnapshot').MockSnapshot }} props */
export function RightSidebar({ snapshot }) {
  const s = snapshot.strings
  const stages = snapshot.pipeline
  const active = stages.find((x) => x.status === 'active')
  const activeIdx = active ? stages.indexOf(active) : 0
  const next = stages[activeIdx + 1]
  const statuses = stages.map((st) => st.status)

  return (
    <aside className="flex w-[272px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-gray-100 bg-white p-4 shadow-sm">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold text-gray-500">整体进度</p>
        <div className="flex items-center gap-4">
          <ProgressRing value={52} />
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <p className="text-[10px] text-gray-400">当前节点</p>
              <p className="text-xs font-semibold text-blue-600">
                ● {active ? `${active.agent} ${pickString(s, active.label_key)}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">下一步</p>
              <p className="text-xs font-medium text-gray-700">
                ○ {next ? `${next.agent} ${pickString(s, next.label_key)}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">预计完成时间</p>
              <p className="text-xs font-medium text-gray-800">2024-06-30</p>
            </div>
          </div>
        </div>

        <div className="mt-3 border-t border-gray-100 pt-3 text-center">
          <p className="text-xs text-gray-500">
            流程已进行{' '}
            <span className="font-bold text-gray-900">{statuses.filter((x) => x === 'done').length}</span>{' '}
            / {stages.length} 节点
          </p>
          <div className="mt-2 flex gap-1">
            {statuses.map((st, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  st === 'done'
                    ? 'bg-emerald-500'
                    : st === 'active'
                      ? 'bg-blue-600'
                      : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-800">
            提醒事项 ({REMINDERS.length})
          </span>
          <button
            type="button"
            className="text-[10px] font-semibold text-blue-600 transition-colors hover:text-blue-700"
          >
            查看全部 →
          </button>
        </div>
        <div className="space-y-2.5">
          {REMINDERS.map((r, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className={`mt-1 size-2 shrink-0 rounded-full ${dotColor[r.level]}`} />
              <div className="min-w-0 flex-1">
                <p
                  className={`text-xs leading-snug ${
                    r.level === 'red' ? 'font-semibold text-red-600' : 'text-gray-700'
                  }`}
                >
                  {r.text}
                </p>
                <p className="mt-0.5 text-[10px] text-gray-400">{r.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold text-gray-800">模块内容总览</p>
        <div className="grid grid-cols-2 gap-3">
          {MODULES.map((m) => {
            const IconComp = m.icon
            const activeCard = m.navId === snapshot.default_nav_id
            return (
              <button
                key={m.navId}
                type="button"
                className={`rounded-xl border p-3 text-left shadow-sm transition-all hover:shadow-md ${
                  activeCard
                    ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500/20'
                    : 'border-gray-100 bg-gray-50/40 hover:border-gray-200'
                }`}
              >
                <div
                  className="mb-2 flex size-8 items-center justify-center rounded-xl shadow-inner ring-1 ring-gray-100"
                  style={{ backgroundColor: m.bg }}
                >
                  <IconComp className="size-[15px]" style={{ color: m.color }} strokeWidth={2} />
                </div>
                <p className="text-xs font-semibold text-gray-900">{pickString(s, m.labelKey)}</p>
                <p className="mt-0.5 whitespace-pre-line text-[10px] leading-snug text-gray-500">{m.sub}</p>
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
