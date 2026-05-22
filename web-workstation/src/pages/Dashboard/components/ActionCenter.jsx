/**
 * ActionCenter — Section 3: 快捷发令枪 (Action Center)
 *
 * Layout:
 *   ─ section title
 *   ─ animated + button (ripple)
 *   ─ copy + subtitle
 *   ─ drag-and-drop upload zone
 *   ─ quick-launch file-type pill buttons
 */

import { useRef, useState } from 'react'
import { Plus, UploadCloud } from 'lucide-react'
import GuidedUploadDrawer from './GuidedUploadDrawer'

export default function ActionCenter({ onSelectFiles, quickFileTypes = [] }) {
  const inputRef        = useRef(null)
  const [dragOver,      setDragOver]      = useState(false)
  const [active,        setActive]        = useState(null)   // id of last-clicked type btn
  const [drawerOpen,    setDrawerOpen]    = useState(false)

  function handlePick(ext) {
    if (inputRef.current) {
      inputRef.current.accept = ext ?? '.pdf,.xlsx,.xls,.doc,.docx,.png,.jpg,.jpeg,.txt'
      inputRef.current.click()
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    // Dropped files → open the guided drawer (files will be auto-classified inside it)
    setDrawerOpen(true)
  }

  function handleChange(e) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) onSelectFiles?.(files)
  }

  function handleDrawerSubmit(fileMap) {
    // fileMap: { [itemId]: File }
    const files = Object.values(fileMap).filter(Boolean)
    if (files.length) onSelectFiles?.(files)
    setDrawerOpen(false)
  }

  return (
    <>
      <div className="flex h-full flex-col rounded-2xl border border-slate-100 bg-white shadow-sm">

        {/* ── Section title ── */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
          <span className="size-1.5 rounded-full bg-blue-500" />
          <h2 className="text-[14px] font-semibold text-slate-900">
            三、快捷发令枪
            <span className="ml-1.5 text-[12px] font-normal text-slate-400">(Action Center)</span>
          </h2>
        </div>

        {/* ── Main content ── */}
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-5">

          {/* Animated + button → open guided drawer */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="新建立项论证任务"
            className="group relative flex size-[88px] shrink-0 items-center justify-center"
          >
            <span
              className="absolute inset-0 animate-ping rounded-full bg-blue-500/12"
              style={{ animationDuration: '2.8s' }}
            />
            <span
              className="absolute inset-2 animate-ping rounded-full bg-blue-500/18"
              style={{ animationDuration: '2.8s', animationDelay: '0.7s' }}
            />
            <span className="relative flex size-[68px] items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/40 ring-4 ring-white transition-transform duration-200 group-hover:scale-105">
              <Plus className="size-8 text-white" strokeWidth={2.5} />
            </span>
          </button>

          {/* Copy */}
          <div className="text-center">
            <h3 className="text-[18px] font-semibold text-slate-900">新建立项论证任务</h3>
            <p className="mt-1.5 max-w-[220px] text-center text-[12.5px] leading-relaxed text-slate-500">
              支持 <span className="font-medium text-slate-700">8 类异构材料</span>
              （临床申请单、报价单、注册证等）一键拖拽上传
            </p>
          </div>

          {/* Drop zone → open guided drawer */}
          <div
            role="button"
            tabIndex={0}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => setDrawerOpen(true)}
            onKeyDown={(e) => e.key === 'Enter' && setDrawerOpen(true)}
            className={[
              'flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-[12.5px] font-medium transition-all',
              dragOver
                ? 'border-blue-400 bg-blue-50 text-blue-600'
                : 'border-slate-200 text-slate-400 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-600',
            ].join(' ')}
          >
            <UploadCloud className="size-4" strokeWidth={1.75} />
            点击或拖拽文件到这里上传
          </div>

          {/* Quick file-type buttons */}
          {quickFileTypes.length > 0 && (
            <div className="flex w-full flex-wrap justify-center gap-2">
              {quickFileTypes.map((ft) => (
                <button
                  key={ft.id}
                  type="button"
                  onClick={() => { setActive(ft.id); setDrawerOpen(true) }}
                  className={[
                    'flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-[12px] font-medium transition-all hover:shadow-sm active:scale-95',
                    ft.colorCls,
                    active === ft.id ? 'ring-2 ring-offset-1 ring-blue-300' : '',
                  ].join(' ')}
                >
                  {ft.label}
                </button>
              ))}
            </div>
          )}

        </div>

        {/* Hidden file input (kept for internal fallback) */}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {/* ── Guided Upload Drawer (portal-level overlay) ── */}
      <GuidedUploadDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleDrawerSubmit}
      />
    </>
  )
}
