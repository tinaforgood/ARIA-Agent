import {
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Info,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'
import { pickString, type MockSnapshot } from '@/data/mockSnapshot'

const ACCENT = {
  emerald: {
    badge: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300',
    ring: 'ring-emerald-500/20',
    pill: 'bg-emerald-500',
  },
  sky: {
    badge: 'border-sky-500/35 bg-sky-500/10 text-sky-300',
    ring: 'ring-sky-500/20',
    pill: 'bg-sky-500',
  },
  amber: {
    badge: 'border-amber-500/35 bg-amber-500/12 text-amber-200',
    ring: 'ring-amber-500/15',
    pill: 'bg-amber-500',
  },
  violet: {
    badge: 'border-violet-500/35 bg-violet-500/12 text-violet-200',
    ring: 'ring-violet-500/20',
    pill: 'bg-violet-500',
  },
} as const

export interface LeftDocPanelProps {
  snapshot: MockSnapshot
}

export function LeftDocPanel({ snapshot }: LeftDocPanelProps) {
  const cats = snapshot.material_categories
  const stats = snapshot.material_stats
  const [expanded, setExpanded] = useState<boolean[]>(() =>
    cats.map(() => true),
  )

  const m = snapshot.strings.material

  const toggleAll = () => {
    const allOpen = expanded.every(Boolean)
    setExpanded(cats.map(() => !allOpen))
  }

  const toggle = (i: number) =>
    setExpanded((e) => {
      const n = [...e]
      n[i] = !n[i]
      return n
    })

  return (
    <aside className="flex w-[300px] shrink-0 flex-col overflow-hidden border-r border-slate-800/90 bg-[#0b1120]">
      {/* Header — 标准资料清单 */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800/90 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight text-slate-100">
            {pickString(snapshot.strings, 'material.checklist_title')}
          </span>
          <button
            type="button"
            className="rounded-md p-0.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
            aria-label="info"
          >
            <Info className="size-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={toggleAll}
          className="text-xs font-medium text-blue-400 transition-colors hover:text-blue-300"
        >
          {expanded.every(Boolean)
            ? pickString(snapshot.strings, 'material.collapse_all')
            : pickString(snapshot.strings, 'material.expand_all')}
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {cats.map((doc, idx) => {
          const a =
            ACCENT[doc.accent as keyof typeof ACCENT] ?? ACCENT.emerald
          const open = expanded[idx]
          return (
            <div
              key={doc.id}
              className={cn(
                'overflow-hidden rounded-xl border border-slate-700/70 bg-[#1E293B]/95 shadow-sm ring-1 ring-inset',
                a.ring,
              )}
            >
              <button
                type="button"
                onClick={() => toggle(idx)}
                className="flex w-full items-center gap-2.5 px-3 py-3 text-left transition-colors hover:bg-slate-800/50"
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-inner',
                    a.pill,
                  )}
                >
                  {doc.id}
                </span>
                <span className="flex-1 text-[12px] font-medium leading-snug text-slate-100">
                  {doc.title}
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                    a.badge,
                  )}
                >
                  {m.status_done_tpl
                    .replace('{done}', String(doc.done))
                    .replace('{total}', String(doc.total))}
                </span>
                {open ? (
                  <ChevronDown className="size-4 shrink-0 text-slate-500" />
                ) : (
                  <ChevronRight className="size-4 shrink-0 text-slate-500" />
                )}
              </button>

              {open && (
                <div className="border-t border-slate-700/60">
                  {doc.items.map((item) => (
                    <div
                      key={item.code}
                      className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-slate-800/35"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/95 shadow-sm">
                        <Check className="size-3.5 stroke-[2.5] text-white" />
                      </span>
                      {item.icon === 'search' ? (
                        <Search className="size-3.5 shrink-0 text-slate-500" />
                      ) : (
                        <FileText className="size-3.5 shrink-0 text-slate-500" />
                      )}
                      <span className="min-w-0 flex-1 text-[12px] leading-snug text-slate-300">
                        <span className="text-slate-500">{item.code}</span>{' '}
                        {item.name}
                      </span>
                      <span className="shrink-0 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                        {pickString(
                          snapshot.strings,
                          'material.item_uploaded',
                        )}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 text-[10px] font-medium text-blue-400 transition-colors hover:text-blue-300"
                      >
                        {pickString(snapshot.strings, 'material.view')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="shrink-0 space-y-3 border-t border-slate-800/90 bg-[#070d18] px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400">
            {m.footer_summary_tpl
              .replace('{done}', String(stats.done))
              .replace('{total}', String(stats.total))}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
              aria-label="filter"
            >
              <SlidersHorizontal className="size-4" />
            </button>
            <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              {pickString(snapshot.strings, 'material.footer_complete')}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="w-full rounded-xl bg-[#2563EB] py-2.5 text-xs font-semibold text-white shadow-[0_4px_14px_-4px_rgba(37,99,235,0.55)] transition-all hover:bg-blue-600 active:scale-[0.99]"
        >
          {pickString(snapshot.strings, 'material.export_list')}
        </button>
      </div>
    </aside>
  )
}
