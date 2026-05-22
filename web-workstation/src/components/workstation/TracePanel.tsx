import * as React from 'react'
import { FileText, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  pickString,
  type EvidenceTrace,
  type EvidenceTraceSlice,
  type MockSnapshot,
  type UiMetricRow,
} from '@/data/mockSnapshot'

function fallbackTrace(row: UiMetricRow): EvidenceTrace | null {
  const c = row.conflictable
  if (!c) return null
  const fname = c.source_file.split(/[/\\]/).pop() ?? c.source_file
  return {
    metric_row_id: row.id,
    field_label_key: row.label_key,
    document_file_name: fname,
    page_number: 1,
    thumbnail_tint: 'from-slate-700/60 to-slate-900',
    slices: [
      {
        id: 'fallback',
        excerpt: `${c.all_values?.[0]?.value ?? c.value}`,
        confidence: 0.82,
        bbox: { x: 0.08, y: 0.22, width: 0.74, height: 0.12 },
        bbox_coordinates_label: '0.080, 0.216, 0.816, 0.336',
      },
    ],
  }
}

interface PdfSnippetProps {
  trace: EvidenceTrace
  snapshot: MockSnapshot
  activeSlice: EvidenceTraceSlice
}

function PdfSnippetPreview({ trace, snapshot, activeSlice }: PdfSnippetProps) {
  const tmpl = pickString(snapshot.strings, 'evidence.page_label')
  const coordPrefix = pickString(snapshot.strings, 'evidence.coord_prefix')
  const pageChip = tmpl.replace('{n}', String(trace.page_number))

  return (
    <div
      className={cn(
        'relative isolate aspect-[210/297] overflow-hidden rounded-lg border border-slate-700/90 shadow-inner bg-gradient-to-br',
        trace.thumbnail_tint,
      )}
    >
      <div className="absolute inset-1 rounded-md bg-white/[0.04] backdrop-blur-[2px]" />
      <div className="absolute left-3 top-3 flex items-center gap-2">
        <FileText className="size-4 text-slate-200/80" />
        <Badge
          variant="secondary"
          className="border-slate-600/90 bg-slate-950/50 text-[10px] font-medium text-slate-200"
        >
          {pageChip}
        </Badge>
      </div>
      {/* PDF grid texture */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `linear-gradient(0deg, transparent 31px, rgba(148,163,184,.6) 32px),
            linear-gradient(90deg, transparent 31px, rgba(148,163,184,.55) 32px)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* BBox */}
      <div
        className="trace-pulse-dot absolute rounded-md border-2 border-red-500 bg-red-500/10 shadow-[0_0_0_4px_rgba(239,68,68,.12)]"
        style={{
          left: `${activeSlice.bbox.x * 100}%`,
          top: `${activeSlice.bbox.y * 100}%`,
          width: `${activeSlice.bbox.width * 100}%`,
          height: `${activeSlice.bbox.height * 100}%`,
        }}
      />
      <span className="absolute bottom-3 right-3 rounded-md border border-blue-400/70 bg-blue-950/80 px-2 py-0.5 text-[10px] font-mono tracking-tight text-blue-100">
        {coordPrefix}:{activeSlice.bbox_coordinates_label}
      </span>
    </div>
  )
}

export interface TracePanelProps {
  snapshot: MockSnapshot
  activeRow: UiMetricRow | null
  trace: EvidenceTrace | null
  rejectNote: string
  onRejectNote: (v: string) => void
  /** Mock handlers for future integration */
  onApprove: () => void
  onReject: () => void
  /** Close the slide-in panel */
  onClose?: () => void
}

export function TracePanel({
  snapshot,
  activeRow,
  trace,
  rejectNote,
  onRejectNote,
  onApprove,
  onReject,
  onClose,
}: TracePanelProps) {
  const s = snapshot.strings
  const effective =
    trace ?? (activeRow ? fallbackTrace(activeRow) : null)
  const firstSlice = effective?.slices?.[0] ?? null
  const fieldLabel = effective
    ? pickString(snapshot.strings, effective.field_label_key)
    : ''

  return (
    <aside className="flex h-full w-full flex-col gap-0 border-l border-gray-200 bg-white shadow-2xl">
      {/* Panel header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">{s.workstation.evidence_panel_title}</p>
          {effective ? (
            <p className="mt-0.5 text-xs text-gray-400">{fieldLabel}</p>
          ) : (
            <p className="mt-0.5 text-xs text-gray-400">{s.workstation.trace_prompt_select_row}</p>
          )}
        </div>
        {onClose && (
          <button type="button" onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors">
            <X className="size-4" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <Card className="border-gray-200 bg-white shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-800">
            {s.workstation.evidence_panel_title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {effective && firstSlice ? (
            <>
              <PdfSnippetPreview
                trace={effective}
                snapshot={snapshot}
                activeSlice={firstSlice}
              />
              <div className="rounded-lg border border-slate-700/80 bg-slate-950/30 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {s.workstation.evidence_bbox_caption}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-200">
                  {firstSlice.excerpt}
                </p>
                <p className="mt-3 text-[11px] text-slate-500">
                  {s.workstation.trace_doc_title_wrap.replace(
                    '{title}',
                    effective.document_file_name,
                  )}{' '}
                  · {s.workstation.trace_confidence_tail}{' '}
                  {Math.round(firstSlice.confidence * 100)}%
                </p>
              </div>

              {/* Additional slices */}
              {effective.slices.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {effective.slices.map((sl: EvidenceTraceSlice, idx: number) => (
                    <Badge
                      key={sl.id}
                      variant={idx === 0 ? 'default' : 'outline'}
                      className="font-mono text-[10px]"
                    >
                      {s.workstation.evidence_slice_badge_tpl.replace(
                        '{n}',
                        String(idx + 1),
                      )}
                      &nbsp;&nbsp;
                      {sl.bbox_coordinates_label.slice(0, 18)}
                      …
                    </Badge>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex aspect-[210/297] items-center justify-center rounded-lg border border-dashed border-slate-700 text-xs text-slate-500">
              {s.workstation.trace_empty_state}
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Approval footer */}
      <div className="shrink-0 border-t border-gray-100 bg-gray-50 p-4">
        <p className="mb-3 text-xs font-semibold text-gray-700">{s.workstation.approval_title}</p>
        <Textarea
          value={rejectNote}
          placeholder={s.workstation.approval_reject_placeholder}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onRejectNote(e.target.value)}
          className="mb-3 text-xs"
        />
        <div className="flex gap-2">
          <Button type="button" variant="destructive" size="sm" className="flex-1" onClick={onReject}>
            {s.workstation.approval_reject}
          </Button>
          <Button type="button" size="sm" className="flex-1" onClick={onApprove}>
            {s.workstation.approval_pass}
          </Button>
        </div>
      </div>
    </aside>
  )
}
