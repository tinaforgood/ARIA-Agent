import { Bell, ChevronDown, Settings } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { AgentTimeline } from '@/components/workstation/AgentTimeline'
import { adaptProjectSnapshot, SNAPSHOT_API_URL } from '@/data/snapshotAdapter'
import { MaterialFlow } from '@/pages/MaterialFlow'
// @ts-ignore
import DynamicUploadManager from '@/pages/DynamicUploadManager'
import {
  hydrateMetricRows,
  mock_snapshot,
  type EvidenceTrace,
  type MockSnapshot,
  type UiMetricRow,
} from '@/data/mockSnapshot'

const NAV_TABS = [
  '工作台',
  '材料流转',
  '进度跟踪',
  '文档中心',
  '统计分析',
  '系统设置',
]

function App() {
  const [snapshot, setSnapshot] = useState<MockSnapshot>(
    mock_snapshot as unknown as MockSnapshot,
  )
  const [loadPhase, setLoadPhase] = useState<'loading' | 'ready'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState('材料流转')
  const [humanLoop, setHumanLoop] = useState<'confirmed' | 'pending'>('confirmed')
  const [chargeResolved, setChargeResolved] = useState(false)
  const [rows, setRows] = useState<UiMetricRow[]>(() =>
    hydrateMetricRows(mock_snapshot as unknown as MockSnapshot),
  )
  const [displayValues, setDisplayValues] = useState<Record<string, string>>(() => ({
    ...(mock_snapshot.display_values as Record<string, string>),
  }))
  const [traceOverrides, setTraceOverrides] = useState<Record<string, EvidenceTrace>>({})

  const s = snapshot.strings

  const evidenceBase = useMemo(
    () => snapshot.evidence_traces as unknown as Record<string, EvidenceTrace | undefined>,
    [snapshot],
  )

  useEffect(() => {
    let aborted = false

    ;(async () => {
      setLoadPhase('loading')
      setLoadError(null)
      try {
        const res = await fetch(SNAPSHOT_API_URL)
        if (!res.ok) {
          const raw = await res.text()
          let detail = `${res.status} ${res.statusText}`
          try {
            const errBody = JSON.parse(raw) as { detail?: unknown }
            if (errBody.detail !== undefined)
              detail =
                typeof errBody.detail === 'object' && errBody.detail !== null
                  ? JSON.stringify(errBody.detail)
                  : String(errBody.detail)
            else detail = raw || detail
          } catch {
            detail = raw || detail
          }
          throw new Error(detail)
        }
        const data: unknown = await res.json()
        if (aborted) return

        const merged = adaptProjectSnapshot(data)
        setSnapshot(merged)
        setRows(hydrateMetricRows(merged))
        setDisplayValues({ ...(merged.display_values as Record<string, string>) })
        setChargeResolved(false)
        setTraceOverrides({})
      } catch (err) {
        if (aborted) return
        console.error('[snapshot]', err)
        setLoadError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!aborted) setLoadPhase('ready')
      }
    })()

    return () => {
      aborted = true
    }
  }, [])

  function handleConfirm460() {
    setChargeResolved(true)
    const patch = snapshot.resolved_charge_patch
    setDisplayValues((d) => ({
      ...d,
      charge_per_exam: patch.display_charge_per_exam,
      annual_revenue: snapshot.resolved_annual_revenue_display,
    }))
    setRows((prev) =>
      prev.map((r) =>
        r.id !== 'row_charge'
          ? r
          : {
              ...r,
              ui_status: 'verified',
              conflictable: structuredClone(patch.conflictable),
              note_key: null,
            },
      ),
    )
    setTraceOverrides((o) => ({
      ...o,
      row_charge: structuredClone(patch.evidence_trace_override),
    }))
  }

  return (
    <div className="relative flex h-screen min-h-[600px] flex-col bg-[#0F172A]">
      {loadPhase === 'loading' ? (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-[#0F172A]/75 backdrop-blur-[2px]">
          <p className="text-sm font-medium text-slate-200">
            正在加载项目数据…
          </p>
        </div>
      ) : null}

      {loadError ? (
        <div
          className="shrink-0 border-b border-amber-500/40 bg-amber-950/50 px-4 py-2 text-center text-xs text-amber-100"
          role="alert"
        >
          无法拉取后端快照，已回退为本地 Mock。原因：{loadError}
          <span className="text-amber-200/80">（{SNAPSHOT_API_URL}）</span>
        </div>
      ) : null}

      <header
        className="flex h-[52px] shrink-0 items-center gap-6 px-5"
        style={{ background: '#0D1B2A' }}
      >
        <div className="mr-2 flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500">
            <Settings className="size-4 text-white" strokeWidth={2} />
          </div>
          <span className="whitespace-nowrap text-[15px] font-bold tracking-wide text-white">
            {s.product_title}
          </span>
        </div>

        <nav className="flex flex-1 items-center gap-1">
          {NAV_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className="relative rounded px-3 py-1.5 text-sm transition-colors"
              style={{
                color: activeTab === tab ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
              }}
            >
              {tab}
              {activeTab === tab ? (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-emerald-400" />
              ) : null}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="relative rounded-lg p-1.5 text-white/60 transition-colors hover:text-white/90"
          >
            <Bell className="size-5" />
            <span className="absolute right-1 top-1 flex size-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
              {s.workstation.notification_badge}
            </span>
          </button>
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-violet-500 text-xs font-bold text-white">
              {s.user_display_name.slice(0, 1)}
            </div>
            <span className="text-sm text-white">{s.user_display_name}</span>
            <ChevronDown className="size-3.5 text-white/40" />
          </div>
        </div>
      </header>

      <AgentTimeline snapshot={snapshot} />

      <main className="flex min-h-0 flex-1 overflow-hidden">
        {activeTab === '文档中心' ? (
          <div className="flex-1 overflow-y-auto">
            <DynamicUploadManager />
          </div>
        ) : (
          <MaterialFlow
            snapshot={snapshot}
            rows={rows}
            displayValues={displayValues}
            chargeResolved={chargeResolved}
            onConfirm460={handleConfirm460}
            humanLoop={humanLoop}
            onHumanLoopChange={setHumanLoop}
            traceOverrides={traceOverrides}
            evidenceBase={evidenceBase}
          />
        )}
      </main>
    </div>
  )
}

export default App
