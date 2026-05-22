import { useState, useEffect } from 'react'
import { ChevronDown, Check, Download, Info, Sparkles, Loader2 } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

/**
 * 轮询指定 case（或默认最新 case）的文件上传状态
 * @param {string|null} caseId — 由外部传入的选中项目 ID
 */
function useUploadedDocs(caseId) {
  const [uploadedIds, setUploadedIds] = useState(/** @type {Set<string>} */ (new Set()))
  const [latestCase,  setLatestCase]  = useState(null)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    // 切换 case 时立即清空旧数据，避免短暂闪烁旧项目内容
    setLoading(true)
    setLatestCase(null)
    setUploadedIds(new Set())

    const poll = async () => {
      try {
        let targetCase = null

        if (caseId) {
          // 拉指定 case
          const res = await fetch(`${API_BASE}/api/cases/${caseId}`)
          if (!res.ok) { setLoading(false); return }
          targetCase = await res.json()
        } else {
          // 未指定时回退到最新 case
          const res = await fetch(`${API_BASE}/api/cases`)
          if (!res.ok) { setLoading(false); return }
          const cases = await res.json()
          if (!cases.length) { setLoading(false); return }
          targetCase = cases[0]
        }

        setLoading(false)
        setLatestCase(targetCase)

        const ids = new Set()
        const st  = targetCase.status

        if (['ready', 'ingesting', 'processing', 'done'].includes(st)) {
          // 已进入流水线：所有文件视为已上传
          ;['basic_info', 'budget_list', 'minutes', 'performance', 'nmpa_cert', 'price_proof']
            .forEach(id => ids.add(id))
        } else if (['uploading', 'created'].includes(st)) {
          // 流水线未启动：通过 /files 接口精确获取已上传分类
          try {
            const fr = await fetch(`${API_BASE}/api/cases/${targetCase.case_id}/files`)
            if (fr.ok) {
              const files = await fr.json()
              Object.keys(files).forEach(id => ids.add(id))
            }
          } catch (_) {}
        }

        setUploadedIds(ids)
      } catch (_) {
        setLoading(false)
      }
    }

    poll()
    const t = setInterval(poll, 6000)
    return () => clearInterval(t)
  }, [caseId])   // caseId 切换时立即重新拉取

  return { uploadedIds, latestCase, loading }
}

function StatusBadge({ isUploaded, isDone }) {
  if (isDone) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">
        <Sparkles className="size-3 text-emerald-500" strokeWidth={2} />
        已解析
      </span>
    )
  }
  if (isUploaded) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
        <Check className="size-3" strokeWidth={3} />
        已上传
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-400">
      待上传
    </span>
  )
}

function CategorySection({ category, isOpen, onToggle, selectedDocId, onView, uploadedIds, caseStatus }) {
  const Icon = category.icon
  const doneCnt   = category.items.filter(it => uploadedIds.has(it.id)).length
  const total     = category.items.length
  const isComplete = doneCnt === total

  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
      {/* Header row */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-slate-50/50"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-blue-50 text-[11px] font-semibold text-blue-600">
            {category.index}
          </span>
          <Icon className="size-4 shrink-0 text-slate-400" strokeWidth={1.75} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-slate-800">{category.title}</p>
            {category.subtitle && (
              <p className="truncate text-[10.5px] text-slate-400">{category.subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={[
              'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium',
              isComplete
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-amber-50 text-amber-600',
            ].join(' ')}
          >
            {isComplete ? '✓ 已完成' : '进行中'} {doneCnt}/{total}
          </span>
          <ChevronDown
            className={[
              'size-4 text-slate-400 transition-transform duration-200',
              isOpen ? 'rotate-0' : '-rotate-90',
            ].join(' ')}
          />
        </div>
      </button>

      {/* Items */}
      <div
        className={[
          'grid transition-[grid-template-rows] duration-300 ease-out',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        ].join(' ')}
      >
        <div className="overflow-hidden">
          <ul className="border-t border-slate-100 px-3 py-1.5">
            {category.items.map((item) => {
              const isUploaded = uploadedIds.has(item.id)
              const isDone     = isUploaded && caseStatus === 'done'
              const isActive   = selectedDocId === item.id
              return (
                <li
                  key={item.id}
                  className={[
                    'group flex items-center justify-between gap-2 rounded-lg px-1.5 py-1.5 transition-colors',
                    isActive ? 'bg-blue-50/80 ring-1 ring-blue-200' : 'hover:bg-slate-50',
                  ].join(' ')}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      {/* status dot */}
                      <div className={[
                        'flex size-4 shrink-0 items-center justify-center rounded-full',
                        isUploaded ? 'bg-emerald-100' : 'border border-dashed border-slate-200',
                      ].join(' ')}>
                        {isUploaded
                          ? <Check className="size-2.5 text-emerald-600" strokeWidth={3} />
                          : <span className="size-1.5 rounded-full bg-slate-300" />}
                      </div>
                      <span className={[
                        'truncate text-[12.5px] font-semibold',
                        isActive ? 'text-blue-700' : (isUploaded ? 'text-slate-700' : 'text-slate-500'),
                      ].join(' ')}>
                        {item.label}
                      </span>
                      {item.required != null && (
                        item.required
                          ? <span className="shrink-0 rounded bg-red-50 px-1 py-0.5 text-[9px] font-bold text-red-500">必填</span>
                          : <span className="shrink-0 rounded bg-slate-50 px-1 py-0.5 text-[9px] text-slate-400">选填</span>
                      )}
                    </div>
                    {item.hint && (
                      <p className="truncate pl-5 text-[10.5px] leading-relaxed text-slate-400">{item.hint}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {isUploaded && (
                      <button
                        type="button"
                        onClick={() => onView?.(item)}
                        className="text-[11px] font-medium text-blue-600 opacity-70 hover:opacity-100 transition-all"
                      >
                        查看
                      </button>
                    )}
                    <StatusBadge isUploaded={isUploaded} isDone={isDone} />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}

/**
 * LeftSidebar — 资料清单（动态接入后端，实时刷新上传状态）
 */
export default function LeftSidebar({ categories, total, selectedDocId, onView, activeCaseId }) {
  const { uploadedIds, latestCase, loading } = useUploadedDocs(activeCaseId)

  const [openIds, setOpenIds] = useState(
    () => new Set(categories.filter((c) => c.defaultOpen).map((c) => c.id)),
  )
  const allOpen = openIds.size === categories.length

  function toggle(id) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setOpenIds(allOpen ? new Set() : new Set(categories.map((c) => c.id)))
  }

  // 动态计算总数
  const allDocIds = categories.flatMap(c => c.items.map(i => i.id))
  const completedCount = allDocIds.filter(id => uploadedIds.has(id)).length
  const totalCount = allDocIds.length

  // 案例状态标签
  const caseStatusLabel = latestCase
    ? latestCase.status === 'done'       ? '✅ 流程已完成'
    : latestCase.status === 'processing' ? '⚙️ Agent 测算中…'
    : latestCase.status === 'ingesting'  ? '🔍 文件解析中…'
    : latestCase.status === 'ready'      ? '📁 文件已归档'
    : '📁 已创建，待上传'
    : null

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col gap-3 overflow-hidden">

      {/* 当前案例提示条 */}
      {loading && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm">
          <Loader2 className="size-3.5 animate-spin text-slate-400" />
          <span className="text-[11px] text-slate-400">连接后端…</span>
        </div>
      )}
      {!loading && latestCase && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
          <p className="truncate text-[11px] font-semibold text-blue-700">
            📋 {latestCase.hospital_name || latestCase.case_id}
          </p>
          <p className="mt-0.5 text-[10px] text-blue-500">{caseStatusLabel}</p>
        </div>
      )}
      {!loading && !latestCase && (
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
          <p className="text-[11px] text-slate-400">暂无案例，请先上传资料</p>
        </div>
      )}

      {/* Card: list */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h3 className="text-[14px] font-semibold text-slate-900">标准资料清单</h3>
            <Info className="size-3.5 text-slate-300" strokeWidth={1.75} />
          </div>
          <button
            type="button"
            onClick={toggleAll}
            className="text-[12px] font-medium text-blue-600 hover:text-blue-700"
          >
            {allOpen ? '收起全部' : '展开全部'}
          </button>
        </div>

        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-1">
          {categories.map((c) => (
            <CategorySection
              key={c.id}
              category={c}
              isOpen={openIds.has(c.id)}
              onToggle={() => toggle(c.id)}
              selectedDocId={selectedDocId}
              onView={onView}
              uploadedIds={uploadedIds}
              caseStatus={latestCase?.status}
            />
          ))}
        </div>
      </div>

      {/* Card: progress + export */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-[13px]">
          <span className="text-slate-500">上传进度</span>
          <span className={`font-semibold ${completedCount === totalCount ? 'text-emerald-600' : 'text-amber-600'}`}>
            {completedCount}/{totalCount} 份材料
          </span>
        </div>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
            style={{ width: totalCount ? `${(completedCount / totalCount) * 100}%` : '0%' }}
          />
        </div>

        {latestCase?.status === 'done' && latestCase?.case_id ? (
          /* 流程完成 → 真实下载链接 */
          <a
            href={`${API_BASE}/api/cases/${latestCase.case_id}/document`}
            download="立项建议书.docx"
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-[13px] font-semibold text-white shadow-sm shadow-emerald-500/30 transition-colors hover:bg-emerald-600"
          >
            <Download className="size-4" strokeWidth={2} />
            下载立项建议书.docx
          </a>
        ) : (
          /* 流程未完成 → 灰色提示 */
          <button
            type="button"
            disabled
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[13px] font-medium text-slate-400 cursor-not-allowed"
          >
            <Download className="size-4" strokeWidth={1.75} />
            {latestCase?.status === 'processing' ? 'Agent 生成中…' : '流程完成后可下载'}
          </button>
        )}
      </div>
    </aside>
  )
}
