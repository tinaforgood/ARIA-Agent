import { AlertCircle, CloudUpload, FileText, HelpCircle } from 'lucide-react'

/**
 * Top metric strip — data-driven cards (demo / dashboard).
 * @type {ReadonlyArray<{
 *   id: string
 *   title: string
 *   value: string
 *   unit: string
 *   status: 'success' | 'danger' | 'hypothesis' | 'neutral'
 *   icon: 'UploadCloud' | 'AlertCircle' | 'HelpCircle' | 'FileText'
 * }>}
 */
export const mockMetrics = [
  { id: 'upload', title: '待上传材料', value: '2', unit: '份', status: 'success', icon: 'UploadCloud' },
  { id: 'conflict', title: '数据冲突告警', value: '1', unit: '处', status: 'danger', icon: 'AlertCircle' },
  { id: 'pending', title: '核心参数待定', value: '2', unit: '项', status: 'hypothesis', icon: 'HelpCircle' },
  { id: 'progress', title: '文书生成进度', value: '0', unit: '%', status: 'neutral', icon: 'FileText' },
]

const ICON_MAP = {
  UploadCloud: CloudUpload,
  AlertCircle,
  HelpCircle,
  FileText,
}

const statusClass = {
  success: {
    top: 'border-t-emerald-500',
    iconWrap: 'bg-emerald-50',
    icon: 'text-emerald-500',
  },
  danger: {
    top: 'border-t-red-500',
    iconWrap: 'bg-red-50',
    icon: 'text-red-500',
  },
  hypothesis: {
    top: 'border-t-blue-600',
    iconWrap: 'rounded-lg border border-slate-100/80 bg-white',
    icon: 'text-blue-600',
  },
  neutral: {
    top: 'border-t-slate-200',
    iconWrap: 'bg-slate-50',
    icon: 'text-slate-600',
  },
}

/**
 * Horizontal KPI cards below the main header (light SaaS shell).
 * @param {{ metrics?: typeof mockMetrics; className?: string }} [props]
 */
export function TopStatusBar({ metrics = mockMetrics, className = '' }) {
  return (
    <section
      className={`border-b border-slate-100/80 bg-slate-50 px-5 py-4 ${className}`.trim()}
      aria-label="工作区关键指标"
    >
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => {
          const styles = statusClass[m.status]
          const Icon = ICON_MAP[m.icon]

          return (
            <article
              key={m.id}
              className={`rounded-2xl border border-slate-100/80 border-t-2 bg-white p-4 ${styles.top}`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex size-10 shrink-0 items-center justify-center ${styles.iconWrap}`}>
                  <Icon className={`size-5 ${styles.icon}`} strokeWidth={2} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-400">{m.title}</p>
                  <p className="mt-1 text-base font-bold tabular-nums text-slate-800">
                    {m.value}
                    <span className="ml-0.5 text-sm font-medium text-slate-400">{m.unit}</span>
                  </p>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
