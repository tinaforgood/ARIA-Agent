import { Plus, Upload } from 'lucide-react'
import type { DragEvent } from 'react'
import { useState } from 'react'

import { cn } from '@/lib/utils'
import { pickString, type MockSnapshot } from '@/data/mockSnapshot'

const EXT_COLOR: Record<string, string> = {
  xlsx: '#10B981',
  pdf: '#EF4444',
  docx: '#3B82F6',
}

export interface MaterialUploadHeroProps {
  snapshot: MockSnapshot
  /** Demo files from snapshot */
  files: ReadonlyArray<{ name: string; size: string; ext: string }>
  dragOver: boolean
  setDragOver: (v: boolean) => void
}

export function MaterialUploadHero({
  snapshot,
  files,
  dragOver,
  setDragOver,
}: MaterialUploadHeroProps) {
  const m = snapshot.strings.material
  const [hover, setHover] = useState(false)
  const active = dragOver || hover

  return (
    <section className="overflow-hidden rounded-xl border border-slate-700/90 bg-[#1E293B] shadow-[0_4px_24px_-8px_rgba(0,0,0,0.45)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-700/70 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">
            {pickString(snapshot.strings, 'material.upload_task_title')}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">
            {pickString(snapshot.strings, 'material.upload_task_subtitle')}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-blue-500/50 hover:bg-slate-800 hover:text-white"
        >
          <Upload className="size-3.5 text-blue-400" />
          {pickString(snapshot.strings, 'material.batch_upload')}
        </button>
      </div>

      <div className="p-5">
        <div
          role="button"
          tabIndex={0}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onDragOver={(e: DragEvent) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e: DragEvent) => {
            e.preventDefault()
            setDragOver(false)
          }}
          className={cn(
            'relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-10 transition-all duration-300',
            active
              ? 'border-blue-400/90 bg-blue-500/[0.08] shadow-[inset_0_1px_0_0_rgba(59,130,246,0.2)]'
              : 'border-slate-600/80 bg-slate-950/25 hover:border-blue-500/50 hover:bg-slate-900/40',
          )}
        >
          {/* ambient glow */}
          <div
            className={cn(
              'pointer-events-none absolute left-1/2 top-[42%] h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/20 blur-3xl transition-opacity duration-500',
              active ? 'opacity-100' : 'opacity-70',
            )}
          />
          <div
            className={cn(
              'relative z-10 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-b from-blue-500 to-blue-700 shadow-[0_0_0_8px_rgba(37,99,235,0.12),0_12px_40px_-6px_rgba(37,99,235,0.55)] transition-transform duration-300',
              active && 'scale-105 shadow-[0_0_0_12px_rgba(37,99,235,0.18),0_16px_48px_-4px_rgba(37,99,235,0.6)]',
            )}
          >
            <Plus className="size-9 text-white drop-shadow-sm" strokeWidth={2.5} />
          </div>
          <div className="relative z-10 text-center">
            <p className="text-sm font-semibold text-slate-100">
              {m.upload_drop_hint}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {pickString(snapshot.strings, 'material.upload_drop_sub')}
            </p>
          </div>
          <p className="relative z-10 max-w-lg text-center text-[11px] leading-relaxed text-slate-500">
            {pickString(snapshot.strings, 'material.upload_formats_short')}
          </p>
        </div>

        {/* 已上传列表 */}
        <div className="mt-6">
          <p className="mb-3 text-xs font-medium text-slate-500">
            {m.uploaded_files_count_tpl.replace('{n}', String(files.length))}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {files.map((f) => (
              <div
                key={f.name}
                className="flex items-center gap-3 rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2.5 transition-colors hover:border-slate-600"
              >
                <div
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: `${EXT_COLOR[f.ext] ?? '#64748b'}18`,
                  }}
                >
                  <span
                    className="text-[10px] font-bold uppercase"
                    style={{ color: EXT_COLOR[f.ext] ?? '#94a3b8' }}
                  >
                    {f.ext}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-200">
                    {f.name}
                  </p>
                  <p className="text-[10px] text-slate-500">{f.size}</p>
                </div>
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/90 text-[10px] font-bold text-white shadow-sm">
                  ✓
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
