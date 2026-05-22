import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, Trash2, Plus, CheckCircle2, Pencil } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

/**
 * StageIndicator — 顶部阶段进度条 + 项目切换下拉
 *
 * Props:
 *   project         — { name } 当前项目（fallback 显示名）
 *   stages          — [{ id:'A1', label, status:'done'|'active'|'pending' }]
 *   allCases        — 全部 case 列表（来自 GET /api/cases）
 *   selectedCaseId  — 当前选中的 case_id
 *   onSelectCase    — (case_id) => void
 *   onDeleteCase    — (case_id) => void
 *   onNewProject    — () => void  → 打开上传抽屉新建项目
 */

const STATUS_BADGE = {
  done:       { label: '已完成', cls: 'bg-emerald-100 text-emerald-700' },
  processing: { label: '处理中', cls: 'bg-blue-100   text-blue-700'    },
  ingesting:  { label: '解析中', cls: 'bg-blue-100   text-blue-700'    },
  error:      { label: '出错',   cls: 'bg-red-100    text-red-600'     },
  ready:      { label: '待运行', cls: 'bg-amber-100  text-amber-700'   },
  uploading:  { label: '上传中', cls: 'bg-slate-100  text-slate-600'   },
  created:    { label: '新建',   cls: 'bg-slate-100  text-slate-500'   },
}

export default function StageIndicator({
  project,
  stages,
  allCases       = [],
  selectedCaseId,
  onSelectCase,
  onDeleteCase,
  onNewProject,
  onRenameCase,   // (caseId, newName) => void
}) {
  const [open,          setOpen]          = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)   // case_id to confirm
  const [editingId,     setEditingId]     = useState(null)   // case_id being renamed
  const [editingName,   setEditingName]   = useState('')
  const editInputRef = useRef(null)
  const dropRef = useRef(null)

  // 点击外部关闭下拉
  useEffect(() => {
    if (!open) return
    function onMouseDown(e) {
      if (!dropRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  const selectedCase  = allCases.find(c => c.case_id === selectedCaseId)
  // 有选中的真实 case 时：用 hospital_name；没名字则用 UUID 片段；完全没 case 才用 mock 名
  const displayName   = selectedCase
    ? (selectedCase.hospital_name?.trim() || `项目 ${selectedCase.case_id.slice(0, 8)}`)
    : (project?.name || '当前项目')

  // 聚焦编辑框
  useEffect(() => {
    if (editingId && editInputRef.current) editInputRef.current.focus()
  }, [editingId])

  function handleDeleteClick(e, caseId) {
    e.stopPropagation()
    setConfirmDelete(caseId)
  }

  function doDelete(caseId) {
    onDeleteCase?.(caseId)
    setConfirmDelete(null)
    setOpen(false)
  }

  function handleRenameClick(e, c) {
    e.stopPropagation()
    setEditingId(c.case_id)
    setEditingName(c.hospital_name?.trim() || '')
  }

  async function commitRename(caseId) {
    const name = editingName.trim()
    setEditingId(null)
    if (!name) return
    onRenameCase?.(caseId, name)   // 乐观更新父级列表
    try {
      const form = new FormData()
      form.append('hospital_name', name)
      await fetch(`${API_BASE}/api/cases/${caseId}`, { method: 'PATCH', body: form })
    } catch (_) {}
  }

  function handleRenameKeyDown(e, caseId) {
    if (e.key === 'Enter') { e.preventDefault(); commitRename(caseId) }
    if (e.key === 'Escape') { setEditingId(null) }
  }

  return (
    <div className="flex items-center gap-6 border-b border-slate-100 bg-white px-8 py-3">

      {/* ── 项目选择器 ────────────────────────────────────────────── */}
      <div className="relative shrink-0" ref={dropRef}>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          <span className="text-slate-400">项目:</span>
          <span className="max-w-[200px] truncate font-medium">{displayName}</span>
          <ChevronDown
            className={`size-3.5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">

            {/* 项目列表 */}
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
              {allCases.length === 0 && (
                <p className="px-4 py-3 text-[12px] text-slate-400">暂无项目</p>
              )}
              {allCases.map(c => {
                const badge     = STATUS_BADGE[c.status] ?? STATUS_BADGE.created
                const isSelected = c.case_id === selectedCaseId
                const isRunning  = ['ingesting', 'processing'].includes(c.status)
                const name       = c.hospital_name?.trim() || `项目 ${c.case_id.slice(0, 8)}`
                const dateStr    = c.created_at
                  ? new Date(c.created_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
                  : ''

                const isEditing = editingId === c.case_id

                return (
                  <div
                    key={c.case_id}
                    onClick={() => { if (!isEditing) { onSelectCase?.(c.case_id); setOpen(false) } }}
                    className={[
                      'group flex cursor-pointer items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-slate-50',
                      isSelected ? 'bg-blue-50/60' : '',
                    ].join(' ')}
                  >
                    {/* 选中状态圆圈 */}
                    {isSelected
                      ? <CheckCircle2 className="size-4 shrink-0 text-blue-500" strokeWidth={2} />
                      : <div className="size-4 shrink-0 rounded-full border-2 border-slate-200" />
                    }

                    {/* 项目名 + 日期 */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onBlur={() => commitRename(c.case_id)}
                          onKeyDown={e => handleRenameKeyDown(e, c.case_id)}
                          onClick={e => e.stopPropagation()}
                          placeholder="输入项目名称"
                          className="w-full rounded-md border border-blue-300 bg-white px-2 py-0.5 text-[13px] font-medium text-slate-800 outline-none ring-1 ring-blue-300"
                        />
                      ) : (
                        <>
                          <p className={`truncate text-[13px] font-medium ${!c.hospital_name?.trim() ? 'italic text-slate-400' : 'text-slate-800'}`}>
                            {name}
                          </p>
                          {dateStr && (
                            <p className="text-[10.5px] text-slate-400">{dateStr}</p>
                          )}
                        </>
                      )}
                    </div>

                    {/* 状态徽章 */}
                    {!isEditing && (
                      <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    )}

                    {/* 重命名按钮（始终可见；铅笔图标） */}
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={(e) => handleRenameClick(e, c)}
                        className="invisible shrink-0 rounded-md p-1 text-slate-300 transition-colors hover:bg-blue-50 hover:text-blue-500 group-hover:visible"
                        title="重命名"
                      >
                        <Pencil className="size-3.5" strokeWidth={2} />
                      </button>
                    )}

                    {/* 删除按钮（运行中不显示） */}
                    {!isRunning && !isEditing && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteClick(e, c.case_id)}
                        className="invisible shrink-0 rounded-md p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 group-hover:visible"
                        title="删除"
                      >
                        <Trash2 className="size-3.5" strokeWidth={2} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 底部：新建项目 */}
            <div className="border-t border-slate-100 px-3 py-2">
              <button
                type="button"
                onClick={() => { setOpen(false); onNewProject?.() }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[12.5px] font-medium text-blue-600 transition-colors hover:bg-blue-50"
              >
                <Plus className="size-3.5" strokeWidth={2.5} />
                新建项目
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 阶段 Pill 列表 ────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-end gap-2 overflow-x-auto">
        {stages.map((stage) => {
          const isDone   = stage.status === 'done'
          const isActive = stage.status === 'active'

          const pillCls = [
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs whitespace-nowrap transition-colors',
            isDone   ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' :
            isActive ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 shadow-sm shadow-blue-500/10' :
                       'bg-slate-50 text-slate-400 ring-1 ring-slate-100',
          ].join(' ')

          const dotCls = [
            'flex size-[18px] items-center justify-center rounded-full text-[10px] font-bold',
            isDone   ? 'bg-emerald-500 text-white' :
            isActive ? 'bg-blue-600 text-white'    :
                       'bg-slate-200 text-slate-400',
          ].join(' ')

          return (
            <div key={stage.id} className={pillCls}>
              <span className={dotCls}>
                {isDone ? <Check className="size-3" strokeWidth={3} /> : stage.id.slice(1)}
              </span>
              <span className="font-medium">{stage.id} {stage.label}</span>
            </div>
          )
        })}
      </div>

      {/* ── 删除确认弹窗 ──────────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]"
            onClick={() => setConfirmDelete(null)}
          />
          <div className="relative w-80 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-red-100">
                <Trash2 className="size-4 text-red-500" strokeWidth={2} />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-slate-800">确认删除该项目？</p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                  删除后将清除所有上传材料和 AI 分析结果，操作不可恢复。
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] text-slate-600 hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => doDelete(confirmDelete)}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-red-700 transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
