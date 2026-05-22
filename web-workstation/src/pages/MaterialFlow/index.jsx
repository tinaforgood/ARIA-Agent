import { useMemo, useState } from 'react'

import { DocPreviewPanel } from '@/components/DocPreviewPanel'
import { EvidencePanel } from '@/components/EvidencePanel'
// @ts-ignore
import GuidedUploadDrawer from '@/pages/Dashboard/components/GuidedUploadDrawer'

import { CenterWorkspace } from './CenterWorkspace'
import { LeftSidebar } from './LeftSidebar'
import { RightSidebar } from './RightSidebar'

/**
 * Material Flow — three-column shell + slide-out preview / evidence.
 * @param {{
 *   snapshot: import('@/data/mockSnapshot').MockSnapshot
 *   rows: import('@/data/mockSnapshot').UiMetricRow[]
 *   displayValues: Record<string, string>
 *   chargeResolved: boolean
 *   onConfirm460: () => void
 *   humanLoop: 'confirmed' | 'pending'
 *   onHumanLoopChange: (v: 'confirmed' | 'pending') => void
 *   traceOverrides: Record<string, import('@/data/mockSnapshot').EvidenceTrace>
 *   evidenceBase: Record<string, import('@/data/mockSnapshot').EvidenceTrace | undefined>
 * }} props
 */
export function MaterialFlow({
  snapshot,
  rows,
  displayValues,
  chargeResolved,
  onConfirm460,
  humanLoop,
  onHumanLoopChange,
  traceOverrides,
  evidenceBase,
}) {
  /** @type {import('./docTypes').PreviewDoc | null} */
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [selectedMetric, setSelectedMetric] = useState(/** @type {string | null} */ (null))
  const [rejectNote, setRejectNote] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const activeMetricRow = useMemo(
    () => (selectedMetric ? rows.find((r) => r.id === selectedMetric) ?? null : null),
    [rows, selectedMetric],
  )

  const traceForPanel = useMemo(() => {
    if (!selectedMetric) return null
    const o = traceOverrides[selectedMetric]
    if (o) return o
    return evidenceBase[selectedMetric] ?? null
  }, [selectedMetric, traceOverrides, evidenceBase])

  const chargeConflict =
    selectedMetric === 'row_charge' &&
    Boolean(rows.find((r) => r.id === 'row_charge')?.conflictable?.conflict)

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[#F3F4F6]">
      {/* Main strip: explicit height budget below chrome — parent supplies flex-1 */}
      <div className="flex min-h-0 w-full flex-1 overflow-hidden bg-white shadow-sm">
        <LeftSidebar snapshot={snapshot} onViewDoc={setSelectedDoc} />
        <CenterWorkspace
          snapshot={snapshot}
          rows={rows}
          displayValues={displayValues}
          chargeResolved={chargeResolved}
          humanLoop={humanLoop}
          onHumanLoopChange={onHumanLoopChange}
          onEditMetric={(rowId) => setSelectedMetric(rowId)}
          onOpenDrawer={() => setDrawerOpen(true)}
        />
        <RightSidebar snapshot={snapshot} />
      </div>

      {selectedDoc ? (
        <>
          <button
            type="button"
            className="absolute inset-0 z-30 bg-gray-900/20 backdrop-blur-[1px]"
            aria-label="关闭预览遮罩"
            onClick={() => setSelectedDoc(null)}
          />
          <div className="slide-in-right absolute inset-y-0 right-0 z-40 w-full max-w-[440px] shadow-2xl">
            <DocPreviewPanel doc={selectedDoc} onClose={() => setSelectedDoc(null)} />
          </div>
        </>
      ) : null}

      {selectedMetric ? (
        <div className="slide-in-right absolute inset-y-0 right-0 z-50 w-full max-w-[400px] shadow-2xl">
          <EvidencePanel
            snapshot={snapshot}
            metricRow={activeMetricRow}
            trace={traceForPanel}
            rejectNote={rejectNote}
            onRejectNote={setRejectNote}
            chargeConflict={chargeConflict}
            chargeResolved={chargeResolved}
            onConfirm460={() => {
              onConfirm460()
              setSelectedMetric(null)
            }}
            onClose={() => setSelectedMetric(null)}
          />
        </div>
      ) : null}

      {/* 新建立项论证任务抽屉 — 在材料流转页也可打开 */}
      <GuidedUploadDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSubmit={() => {}}
      />
    </div>
  )
}

export default MaterialFlow
