import { ChevronDown, ChevronRight, FileText, Info, ClipboardList, ShieldCheck, Loader2, Check } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

/** 与 GuidedUploadDrawer 6 类完全对齐的资料清单 */
const STATIC_CATEGORIES = [
  {
    id: 1,
    title: '院内申报材料',
    subtitle: '由医院职能部门提供',
    Icon: ClipboardList,
    color: 'bg-blue-600',
    docs: [
      { id: 'basic_info',  name: '基本情况表',   hint: '医院/科室床位、诊疗量等核心指标', required: true  },
      { id: 'budget_list', name: '预算清单',     hint: '拟申请设备预算项目清单',           required: true  },
      { id: 'minutes',     name: '论证纪要',     hint: '预算论证会议纪要，需签字确认',     required: true  },
      { id: 'performance', name: '绩效目标表',   hint: '市级财政绩效申报表',               required: true  },
    ],
  },
  {
    id: 2,
    title: '合规证明材料',
    subtitle: '由厂商或监管部门提供',
    Icon: ShieldCheck,
    color: 'bg-violet-600',
    docs: [
      { id: 'nmpa_cert',   name: 'NMPA 注册证',  hint: '国家药监局注册证，确认在有效期内', required: false },
      { id: 'price_proof', name: '价格依据证明',  hint: '含税报价单或询价记录（≥1家）',    required: true  },
    ],
  },
]

/**
 * 拉取最新 case 的已上传文件列表，返回 Set<category_id>
 * 轮询间隔 6 秒
 */
function useUploadedCategories() {
  const [uploaded, setUploaded] = useState(/** @type {Set<string>} */ (new Set()))
  const [latestCase, setLatestCase] = useState(null)

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cases`)
      if (!res.ok) return
      const cases = await res.json()
      if (!cases.length) return
      // 取最新的 case
      const latest = cases[0]
      setLatestCase(latest)
      // 拉 case 上传目录快照：直接看 metadata 里有没有文件信息
      // 简单方案：如果 status >= ready，说明文件已上传
      const uploaded_ = new Set()
      if (['ready','ingesting','processing','done'].includes(latest.status)) {
        // 尝试拉 snapshot，看 uploads 哪些分类有文件
        try {
          const sr = await fetch(`${API_BASE}/api/cases/${latest.case_id}/snapshot`)
          if (sr.ok) {
            // snapshot 存在说明 ingest 完成；假设全部已上传
            STATIC_CATEGORIES.flatMap(g => g.docs).forEach(d => uploaded_.add(d.id))
          }
        } catch(_) {}
      }
      setUploaded(uploaded_)
    } catch(_) {}
  }, [])

  useEffect(() => {
    fetch_()
    const t = setInterval(fetch_, 6000)
    return () => clearInterval(t)
  }, [fetch_])

  return { uploaded, latestCase }
}

/**
 * @param {{
 *   snapshot: import('@/data/mockSnapshot').MockSnapshot
 *   onViewDoc: (doc: import('./docTypes').PreviewDoc) => void
 * }} props
 */
export function LeftSidebar({ snapshot, onViewDoc }) {
  const [expandedById, setExpandedById] = useState(() =>
    Object.fromEntries(STATIC_CATEGORIES.map((c) => [c.id, true])),
  )
  const { uploaded, latestCase } = useUploadedCategories()

  const allOpen = STATIC_CATEGORIES.every((c) => expandedById[c.id])
  const toggleCategory = (id) => setExpandedById((prev) => ({ ...prev, [id]: !prev[id] }))
  const toggleAll = () => {
    const next = !allOpen
    setExpandedById(Object.fromEntries(STATIC_CATEGORIES.map((c) => [c.id, next])))
  }

  return (
    <aside className="flex h-full min-h-0 w-80 shrink-0 flex-col border-r border-slate-100/80 bg-white shadow-[2px_0_16px_-6px_rgba(0,0,0,0.06)]">
      {/* 标题栏 */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100/80 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-base font-bold text-slate-800">标准资料清单</h2>
          <button type="button"
            className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
            aria-label="说明">
            <Info className="size-3.5" strokeWidth={2} />
          </button>
        </div>
        <button type="button" onClick={toggleAll}
          className="shrink-0 text-xs font-medium text-blue-600 transition-colors hover:underline">
          {allOpen ? '收起全部' : '展开全部'}
        </button>
      </div>

      {/* 当前案例提示 */}
      {latestCase && (
        <div className="mx-3 mt-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
          <p className="text-[11px] font-medium text-blue-700 truncate">
            📋 {latestCase.hospital_name || '当前案例'}
          </p>
          <p className="text-[10px] text-blue-500 mt-0.5">
            {latestCase.status === 'done' ? '✅ 流程已完成' :
             latestCase.status === 'processing' ? '⚙️ Agent 测算中…' :
             latestCase.status === 'ingesting' ? '🔍 文件解析中…' :
             '📁 已创建，待上传'}
          </p>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {STATIC_CATEGORIES.map((category, idx) => {
          const { Icon, color } = category
          const open = expandedById[category.id]
          const doneCnt = category.docs.filter(d => uploaded.has(d.id)).length
          const total = category.docs.length
          const allDone = doneCnt === total

          return (
            <div key={category.id}
              className="overflow-hidden rounded-2xl border border-slate-100/80 bg-white">
              {/* 分组标题 */}
              <button type="button" onClick={() => toggleCategory(category.id)}
                className="flex w-full items-center gap-2.5 px-3 py-3 text-left transition-colors hover:bg-slate-50">
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${color} text-[11px] font-bold text-white`}>
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{category.title}</p>
                  <p className="text-[10.5px] text-slate-400">{category.subtitle}</p>
                </div>
                <span className={`shrink-0 text-[11px] font-semibold ${allDone ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {allDone ? `✓ 已完成 ${total}/${total}` : `${doneCnt}/${total}`}
                </span>
                {open
                  ? <ChevronDown className="size-4 shrink-0 text-slate-400" aria-hidden />
                  : <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />}
              </button>

              {open && (
                <div className="divide-y divide-slate-100/80 border-t border-slate-100/80">
                  {category.docs.map((doc) => {
                    const isUploaded = uploaded.has(doc.id)
                    return (
                      <div key={doc.id}
                        className="flex items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-slate-50">
                        {/* 状态图标 */}
                        <div className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${isUploaded ? 'bg-emerald-100' : 'border border-dashed border-slate-200'}`}>
                          {isUploaded
                            ? <Check className="size-3 text-emerald-600" strokeWidth={3} />
                            : <span className="size-1.5 rounded-full bg-slate-300" />}
                        </div>
                        {/* 名称 + hint */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[13px] font-semibold ${isUploaded ? 'text-slate-700' : 'text-slate-500'}`}>
                              {doc.name}
                            </span>
                            {doc.required
                              ? <span className="rounded bg-red-50 px-1 py-0.5 text-[9px] font-bold text-red-500">必填</span>
                              : <span className="rounded bg-slate-50 px-1 py-0.5 text-[9px] text-slate-400">选填</span>}
                          </div>
                          <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-400 truncate">{doc.hint}</p>
                        </div>
                        {/* 操作 */}
                        {isUploaded ? (
                          <button type="button"
                            onClick={() => onViewDoc(buildPreviewDoc(snapshot, category.title, category.id, doc))}
                            className="shrink-0 text-[11px] font-medium text-blue-600 hover:underline mt-0.5">
                            查看
                          </button>
                        ) : (
                          <span className="shrink-0 text-[11px] text-slate-300 mt-0.5">待上传</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}

/**
 * @param {import('@/data/mockSnapshot').MockSnapshot} snapshot
 * @param {string} categoryTitle
 * @param {number} categoryId
 * @param {{ id: string; name: string }} doc
 */
function buildPreviewDoc(snapshot, categoryTitle, categoryId, doc) {
  return {
    id: `${categoryId}-${doc.id}`,
    fileName: `${doc.name}.pdf`,
    dept: categoryTitle,
    extracted: defaultExtracted(snapshot, doc.name),
  }
}

/** @param {import('@/data/mockSnapshot').MockSnapshot} snapshot */
function defaultExtracted(snapshot, itemName) {
  const equip = snapshot.strings.project_selector_value.includes('3.0T') ? '3.0T MRI' : '磁共振'
  return [
    { label: '设备名称', value: equip, ok: true },
    { label: '申请科室', value: '放射科', ok: true },
    { label: '关联材料', value: itemName, ok: true },
  ]
}
