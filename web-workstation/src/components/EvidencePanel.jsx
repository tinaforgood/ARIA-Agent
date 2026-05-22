import { AlertTriangle, FileText, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { pickString } from '@/data/mockSnapshot'

/**
 * Evidence chain slide-out for metric conflicts / trace review.
 * @param {{
 *   snapshot: import('@/data/mockSnapshot').MockSnapshot
 *   metricRow: import('@/data/mockSnapshot').UiMetricRow | null
 *   trace: import('@/data/mockSnapshot').EvidenceTrace | null
 *   rejectNote: string
 *   onRejectNote: (v: string) => void
 *   chargeConflict: boolean
 *   chargeResolved: boolean
 *   onConfirm460: () => void
 *   onClose: () => void
 * }} props
 */
export function EvidencePanel({
  snapshot,
  metricRow,
  trace,
  rejectNote,
  onRejectNote,
  chargeConflict,
  chargeResolved,
  onConfirm460,
  onClose,
}) {
  const s = snapshot.strings
  const slice = trace?.slices?.[0]
  const fieldLabel = trace ? pickString(snapshot.strings, trace.field_label_key) : ''

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden rounded-l-2xl border-l border-gray-100 bg-white shadow-2xl shadow-black/10">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 bg-gray-50/90 px-5 py-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{s.workstation.evidence_panel_title}</p>
          <p className="mt-1 text-xs text-gray-500">
            {metricRow ? fieldLabel || pickString(snapshot.strings, metricRow.label_key) : s.workstation.trace_prompt_select_row}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
          aria-label="关闭"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {chargeConflict && !chargeResolved ? (
          <div className="rounded-2xl border border-red-100 bg-red-50/80 p-4 shadow-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-red-800">单次收费标准冲突</p>
                <p className="mt-1 text-xs leading-relaxed text-red-700/90">
                  {pickString(snapshot.strings, 'metric_notes.conflict_hint')}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {[
                { val: '¥430/次', src: '申报材料 · user_upload', accent: 'border-blue-200 bg-white' },
                { val: '¥460/次', src: '历史归档 · agent_corpus', accent: 'border-gray-200 bg-white' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => {
                    if (opt.val.includes('460')) onConfirm460()
                    onClose()
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/60',
                    opt.accent,
                  )}
                >
                  <span>{opt.val}</span>
                  <span className="text-[11px] font-normal text-gray-500">{opt.src}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {trace && slice ? (
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <FileText className="size-4 text-blue-600" />
              <span className="text-xs font-semibold text-gray-700">
                {s.workstation.evidence_bbox_caption}
              </span>
            </div>
            <div
              className={cn(
                'relative isolate aspect-[210/297] overflow-hidden bg-gradient-to-br p-5 shadow-inner',
                trace.thumbnail_tint,
              )}
            >
              <div
                className="absolute inset-0 opacity-[0.08]"
                style={{
                  backgroundImage: `linear-gradient(0deg, transparent 31px, rgba(148,163,184,.7) 32px),
                    linear-gradient(90deg, transparent 31px, rgba(148,163,184,.65) 32px)`,
                  backgroundSize: '32px 32px',
                }}
              />
              <div
                className="trace-pulse-dot absolute rounded-md border-2 border-red-500 bg-red-500/10 shadow-[0_0_0_4px_rgba(239,68,68,.12)]"
                style={{
                  left: `${slice.bbox.x * 100}%`,
                  top: `${slice.bbox.y * 100}%`,
                  width: `${slice.bbox.width * 100}%`,
                  height: `${slice.bbox.height * 100}%`,
                }}
              />
              <p className="relative mt-auto text-xs leading-relaxed text-gray-700">
                {slice.excerpt}
              </p>
            </div>
            <div className="border-t border-gray-100 px-4 py-3 text-[11px] text-gray-500">
              {s.workstation.trace_doc_title_wrap.replace('{title}', trace.document_file_name)} ·{' '}
              {s.workstation.trace_confidence_tail} {Math.round(slice.confidence * 100)}%
            </div>
          </section>
        ) : (
          !chargeConflict || chargeResolved ? (
            <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-xs text-gray-500">
              {s.workstation.trace_empty_state}
            </div>
          ) : null
        )}
      </div>

      <footer className="shrink-0 space-y-3 border-t border-gray-100 bg-gray-50 p-5">
        <p className="text-xs font-semibold text-gray-800">{s.workstation.approval_title}</p>
        <Textarea
          value={rejectNote}
          placeholder={s.workstation.approval_reject_placeholder}
          onChange={(e) => onRejectNote(e.target.value)}
          className="min-h-[72px] resize-none text-xs"
        />
        <div className="flex gap-2">
          <Button type="button" variant="destructive" size="sm" className="flex-1 rounded-xl" onClick={onClose}>
            {s.workstation.approval_reject}
          </Button>
          <Button type="button" size="sm" className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700" onClick={onClose}>
            {s.workstation.approval_pass}
          </Button>
        </div>
      </footer>
    </aside>
  )
}
