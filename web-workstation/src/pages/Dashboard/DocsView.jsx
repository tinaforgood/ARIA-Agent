/**
 * DocsView — 文档中心页面（接入真实 agent_corpus）
 *
 * 布局：
 *   1. 搜索栏 + 上传按钮
 *   2. 页面标题区
 *   3. 四库卡片（动态文件数）
 *   4. 最近更新表格  +  知识库结构甜甜圈图
 *   5. 底部静态知识提示栏
 *   6. 上传弹窗（选择知识库 + 拖拽上传）
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search, Upload, ShieldCheck, SlidersHorizontal,
  TrendingUp, BarChart2, FileText, RefreshCw, Info,
  ArrowRight, X, CheckCircle2, Loader2, CloudUpload,
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

// ─── 知识库静态配置 ────────────────────────────────────────────────────────────
const KB_CONFIG = {
  c_compliance: {
    id: 'c_compliance',
    title: '合规监管知识库',
    sub: 'Regulatory & Compliance',
    Icon: ShieldCheck,
    iconBg: 'bg-blue-50',
    iconCls: 'text-blue-500',
    borderCls: 'border-blue-400',
    tagCls: 'bg-blue-50 text-blue-600',
    dirCls: 'bg-blue-50 text-blue-600',
    color: '#3B82F6',
    desc: '存储国家和医院的采购管理办法、医疗设备配置标准等法规文件。',
    tags: ['采购管理', '大型设备配置', '医疗设备监管', '招投标规范'],
    statLabels: ['文件数', '来源数'],
  },
  a_requirements: {
    id: 'a_requirements',
    title: '设备技术参数库',
    sub: 'Device Technical Specs',
    Icon: SlidersHorizontal,
    iconBg: 'bg-emerald-50',
    iconCls: 'text-emerald-500',
    borderCls: 'border-emerald-400',
    tagCls: 'bg-emerald-50 text-emerald-600',
    dirCls: 'bg-emerald-50 text-emerald-600',
    color: '#10B981',
    desc: '存储历史已通过的立项报告、设备技术规格书，为当前立项的技术参数对比提供参照。',
    tags: ['立项报告', '技术规格', '设备参数', '配置标准'],
    statLabels: ['文件数', '案例数'],
  },
  d_operations: {
    id: 'd_operations',
    title: '运营财务基线库',
    sub: 'Operations & Finance',
    Icon: TrendingUp,
    iconBg: 'bg-orange-50',
    iconCls: 'text-orange-500',
    borderCls: 'border-orange-400',
    tagCls: 'bg-orange-50 text-orange-600',
    dirCls: 'bg-orange-50 text-orange-600',
    color: '#F97316',
    desc: '存储医院历史运营数据、收费标准、收益测算模型，为财务可行性分析提供基线。',
    tags: ['收费标准', '收益测算', '运营数据', '医保比例'],
    statLabels: ['文件数', '数据表'],
  },
  b_competitors: {
    id: 'b_competitors',
    title: '品牌竞品分析库',
    sub: 'Competitor Intelligence',
    Icon: BarChart2,
    iconBg: 'bg-violet-50',
    iconCls: 'text-violet-500',
    borderCls: 'border-violet-400',
    tagCls: 'bg-violet-50 text-violet-600',
    dirCls: 'bg-violet-50 text-violet-600',
    color: '#8B5CF6',
    desc: '聚合各厂家的历史彩页、参数表和注册证，帮助 Agent 在解析和对比备品类的技术指标。',
    tags: ['MRI 设备', '技术参数', '注册证', '产品概览'],
    statLabels: ['文件数', '厂商数'],
  },
}

const KB_ORDER = ['c_compliance', 'a_requirements', 'd_operations', 'b_competitors']

// ─── Donut chart ──────────────────────────────────────────────────────────────
function DonutChart({ items }) {
  const total = items.reduce((s, i) => s + i.count, 0)
  if (!total) return <div className="size-[162px] rounded-full bg-slate-100" />
  const R = 70, SW = 22
  const C = 2 * Math.PI * R
  const GAP = 4
  let cumPct = 0
  const segments = items.map((item) => {
    const pct    = item.count / total
    const len    = pct * C - GAP
    const offset = -(cumPct * C)
    cumPct += pct
    return { ...item, len, offset }
  })
  return (
    <svg width={R*2+SW+4} height={R*2+SW+4} viewBox={`${-SW/2-2} ${-SW/2-2} ${R*2+SW+4} ${R*2+SW+4}`}>
      <g transform={`rotate(-90 ${R} ${R})`}>
        {segments.map((seg) => (
          <circle key={seg.id} cx={R} cy={R} r={R} fill="none"
            stroke={seg.color} strokeWidth={SW}
            strokeDasharray={`${seg.len} ${C-seg.len}`}
            strokeDashoffset={seg.offset} strokeLinecap="butt" />
        ))}
      </g>
      <text x={R} y={R-6}  textAnchor="middle" fontSize={11} fill="#94a3b8">总文件数</text>
      <text x={R} y={R+14} textAnchor="middle" fontSize={22} fontWeight={700} fill="#0f172a">
        {total.toLocaleString()}
      </text>
      <text x={R} y={R+30} textAnchor="middle" fontSize={11} fill="#94a3b8">份</text>
    </svg>
  )
}

// ─── KB Card ──────────────────────────────────────────────────────────────────
function KbCard({ cfg, data, selected, onClick }) {
  const { Icon } = cfg
  const count = data?.count ?? 0
  return (
    <div
      onClick={onClick}
      className={[
        'flex cursor-pointer flex-col gap-3 rounded-2xl border-2 bg-white p-5 shadow-sm transition-all hover:shadow-md',
        selected ? `${cfg.borderCls} shadow-md` : 'border-slate-100',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${cfg.iconBg}`}>
          <Icon className={`size-6 ${cfg.iconCls}`} strokeWidth={1.75} />
        </div>
        <div>
          <div className="text-[15px] font-semibold text-slate-900">{cfg.title} /</div>
          <div className="text-[12px] text-slate-500">{cfg.sub}</div>
          <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10.5px] font-mono font-medium ${cfg.dirCls}`}>
            {cfg.id}
          </span>
        </div>
      </div>
      <p className="text-[12.5px] leading-relaxed text-slate-600">{cfg.desc}</p>
      <div className="flex gap-4 border-t border-slate-50 pt-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-slate-400">{cfg.statLabels[0]}</span>
          <span className="text-[13.5px] font-semibold text-slate-800">{count.toLocaleString()}</span>
        </div>
        {data?.files?.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-slate-400">最近更新</span>
            <span className="text-[13.5px] font-semibold text-slate-800">
              {data.files[0]?.mtime_iso?.slice(0, 10) ?? '—'}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {cfg.tags.map((tag) => (
          <span key={tag} className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${cfg.tagCls}`}>
            {tag}
          </span>
        ))}
      </div>
      <button type="button" className={`mt-auto flex items-center gap-1 text-[12px] font-medium ${cfg.iconCls} hover:underline`}>
        查看全部 <ArrowRight className="size-3.5" strokeWidth={2} />
      </button>
    </div>
  )
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────
function UploadModal({ onClose, onUploaded }) {
  const [selectedDir, setSelectedDir] = useState('a_requirements')
  const [dragOver,    setDragOver]    = useState(false)
  const [files,       setFiles]       = useState([])   // {file, status:'pending'|'uploading'|'done'|'error', msg}
  const [uploading,   setUploading]   = useState(false)
  const inputRef = useRef(null)

  const addFiles = useCallback((fileList) => {
    const allowed = ['.pdf','.docx','.xlsx','.xls','.pptx','.png','.jpg','.jpeg']
    const newItems = Array.from(fileList)
      .filter(f => allowed.some(ext => f.name.toLowerCase().endsWith(ext)))
      .map(f => ({ file: f, status: 'pending', msg: '' }))
    setFiles(prev => [...prev, ...newItems])
  }, [])

  async function handleUpload() {
    if (!files.length || uploading) return
    setUploading(true)
    const results = [...files]
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'done') continue
      results[i] = { ...results[i], status: 'uploading' }
      setFiles([...results])
      try {
        const form = new FormData()
        form.append('dir_id', selectedDir)
        form.append('file', results[i].file)
        const res = await fetch(`${API_BASE}/api/corpus/upload`, { method: 'POST', body: form })
        if (res.ok) {
          const data = await res.json()
          results[i] = { ...results[i], status: 'done', msg: data.saved_as }
        } else {
          const err = await res.json().catch(() => ({}))
          results[i] = { ...results[i], status: 'error', msg: err.detail || '上传失败' }
        }
      } catch (_) {
        results[i] = { ...results[i], status: 'error', msg: '网络错误' }
      }
      setFiles([...results])
    }
    setUploading(false)
    const anyDone = results.some(r => r.status === 'done')
    if (anyDone) onUploaded?.()
  }

  const doneCnt  = files.filter(f => f.status === 'done').length
  const allDone  = files.length > 0 && doneCnt === files.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-[540px] rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900">上传新知识</h2>
            <p className="text-[12px] text-slate-500">文件将写入共享知识库，供所有 Agent 使用</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="size-5" strokeWidth={2} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Dir selector */}
          <div>
            <label className="mb-2 block text-[13px] font-medium text-slate-700">选择目标知识库</label>
            <div className="grid grid-cols-2 gap-2">
              {KB_ORDER.map(id => {
                const cfg = KB_CONFIG[id]
                const { Icon } = cfg
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedDir(id)}
                    className={[
                      'flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left transition-colors',
                      selectedDir === id ? `${cfg.borderCls} bg-white` : 'border-slate-100 hover:border-slate-200 bg-white',
                    ].join(' ')}
                  >
                    <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${cfg.iconBg}`}>
                      <Icon className={`size-4 ${cfg.iconCls}`} strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-[12.5px] font-medium text-slate-800">{cfg.title}</p>
                      <p className="text-[10.5px] font-mono text-slate-400">{id}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
            onClick={() => inputRef.current?.click()}
            className={[
              'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-8 transition-colors',
              dragOver ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50',
            ].join(' ')}
          >
            <CloudUpload className="mb-2 size-8 text-slate-300" strokeWidth={1.5} />
            <p className="text-[13px] font-medium text-slate-600">点击或拖拽文件到此处</p>
            <p className="mt-1 text-[11.5px] text-slate-400">支持 PDF / Excel / Word / PPT / 图片，单文件 ≤ 100MB</p>
            <input ref={inputRef} type="file" multiple className="hidden"
              accept=".pdf,.docx,.xlsx,.xls,.pptx,.png,.jpg,.jpeg"
              onChange={e => addFiles(e.target.files)} />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="max-h-44 overflow-y-auto space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 p-3">
              {files.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2.5 rounded-lg bg-white px-3 py-2 shadow-sm">
                  <FileText className="size-4 shrink-0 text-slate-400" strokeWidth={1.75} />
                  <span className="flex-1 truncate text-[12px] text-slate-700">{item.file.name}</span>
                  {item.status === 'pending'   && <span className="text-[10.5px] text-slate-400">待上传</span>}
                  {item.status === 'uploading' && <Loader2 className="size-4 animate-spin text-blue-500" />}
                  {item.status === 'done'      && <CheckCircle2 className="size-4 text-emerald-500" strokeWidth={2} />}
                  {item.status === 'error'     && <span className="text-[10.5px] text-red-500">{item.msg}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <span className="text-[12px] text-slate-400">
            {files.length > 0 ? `已选 ${files.length} 个文件，${doneCnt} 个已上传` : '未选择文件'}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] text-slate-600 hover:bg-slate-50 transition-colors">
              {allDone ? '关闭' : '取消'}
            </button>
            {!allDone && (
              <button
                type="button"
                onClick={handleUpload}
                disabled={!files.length || uploading}
                className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-[13px] font-medium text-white shadow-sm shadow-blue-500/30 transition-colors hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" strokeWidth={2} />}
                {uploading ? '上传中…' : '开始上传'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DocsView() {
  const [selectedKb,   setSelectedKb]   = useState('a_requirements')
  const [corpusData,   setCorpusData]   = useState(null)   // GET /api/corpus 返回数据
  const [loading,      setLoading]      = useState(true)
  const [uploadOpen,   setUploadOpen]   = useState(false)

  const fetchCorpus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/corpus`)
      if (res.ok) setCorpusData(await res.json())
    } catch (_) {}
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCorpus()
  }, [fetchCorpus])

  // 构造渲染用的 kbList
  const kbList = KB_ORDER.map(id => {
    const cfg  = KB_CONFIG[id]
    const data = corpusData?.dirs?.[id] ?? null
    return { ...cfg, count: data?.count ?? 0, data }
  })
  const total = kbList.reduce((s, k) => s + k.count, 0)

  // 最近更新列表
  const recentDocs = corpusData?.recent ?? []

  return (
    <main className="flex flex-1 flex-col">

      {/* ── Search bar ── */}
      <div className="border-b border-slate-100 bg-white px-8 py-3">
        <div className="mx-auto flex max-w-[1600px] items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" strokeWidth={1.75} />
            <input
              type="text"
              placeholder="搜索历史知识，支持 Cmd+K"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-[13.5px] text-slate-700 placeholder-slate-400 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2.5 text-[13px] font-medium text-white shadow-sm shadow-blue-500/30 hover:bg-blue-600 transition-colors"
          >
            <Upload className="size-4" strokeWidth={2} />
            上传新知识
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] flex-1 space-y-6 px-8 py-6">

        {/* ── Title ── */}
        <div>
          <h1 className="text-[22px] font-bold text-slate-900">文档中心</h1>
          <p className="mt-1 text-[13px] text-slate-500">
            系统静态知识底座（agent_corpus），为智能体提供比对和学习的参考库
            {loading && <span className="ml-2 text-[11px] text-slate-400">加载中…</span>}
          </p>
        </div>

        {/* ── 4 KB Cards ── */}
        <div className="grid grid-cols-4 gap-4">
          {kbList.map((kb) => (
            <KbCard
              key={kb.id}
              cfg={kb}
              data={corpusData?.dirs?.[kb.id]}
              selected={selectedKb === kb.id}
              onClick={() => setSelectedKb(kb.id)}
            />
          ))}
        </div>

        {/* ── Bottom section ── */}
        <div className="flex gap-4">

          {/* Recent updates table */}
          <div className="flex-1 rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="size-4 text-slate-400" strokeWidth={1.75} />
                <h3 className="text-[14px] font-semibold text-slate-900">最近更新</h3>
              </div>
              <button type="button" onClick={fetchCorpus}
                className="flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:text-blue-700">
                刷新 <RefreshCw className="size-3.5" strokeWidth={2} />
              </button>
            </div>

            {recentDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <FileText className="mb-2 size-8" strokeWidth={1.5} />
                <p className="text-[13px]">{loading ? '加载中…' : '暂无文件，点击「上传新知识」添加'}</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-50 bg-slate-50/60">
                    <th className="px-5 py-2.5 text-left text-[11.5px] font-medium text-slate-500">文档名称</th>
                    <th className="px-4 py-2.5 text-left text-[11.5px] font-medium text-slate-500">所属库</th>
                    <th className="px-4 py-2.5 text-left text-[11.5px] font-medium text-slate-500">类型</th>
                    <th className="px-4 py-2.5 text-left text-[11.5px] font-medium text-slate-500">更新时间</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDocs.map((doc, idx) => {
                    const cfg = KB_CONFIG[doc.dir_id]
                    if (!cfg) return null
                    const { Icon } = cfg
                    const ext = doc.name.split('.').pop()?.toUpperCase() ?? 'FILE'
                    const extCls =
                      ext === 'PDF'  ? 'bg-red-50 text-red-600' :
                      ext === 'XLSX' || ext === 'XLS' ? 'bg-emerald-50 text-emerald-600' :
                      ext === 'DOCX' ? 'bg-blue-50 text-blue-600' :
                      'bg-slate-100 text-slate-500'
                    return (
                      <tr key={idx} className="border-b border-slate-50 transition-colors hover:bg-slate-50/50">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <FileText className={`size-4 shrink-0 ${cfg.iconCls}`} strokeWidth={1.75} />
                            <span className="max-w-[340px] truncate text-[12.5px] text-slate-700">{doc.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Icon className={`size-3.5 ${cfg.iconCls}`} strokeWidth={1.75} />
                            <span className="text-[12px] text-slate-600">{cfg.title}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${extCls}`}>
                            {ext}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-slate-400">{doc.mtime_iso}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Donut chart */}
          <div className="w-[340px] shrink-0 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <BarChart2 className="size-4 text-slate-400" strokeWidth={1.75} />
              <h3 className="text-[14px] font-semibold text-slate-900">知识库结构</h3>
            </div>

            <div className="flex items-center gap-6">
              <DonutChart items={kbList} />
              <div className="flex flex-1 flex-col gap-3">
                {kbList.map((kb) => {
                  const pct = total ? ((kb.count / total) * 100).toFixed(1) : '0.0'
                  return (
                    <div key={kb.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: kb.color }} />
                        <span className="truncate text-[12px] text-slate-600">{kb.title}</span>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-[12px] font-medium text-slate-700">{kb.count.toLocaleString()} 份</span>
                        <span className="ml-1.5 text-[11px] text-slate-400">{pct}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3 text-[11.5px] text-slate-400">
              <span>总计 {total.toLocaleString()} 份</span>
              <button type="button" onClick={fetchCorpus} className="text-blue-500 hover:text-blue-600">
                <RefreshCw className="size-3.5" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Bottom notice ── */}
        <div className="flex items-center gap-2 rounded-xl bg-blue-50/60 px-5 py-3 text-[13px] text-slate-600">
          <Info className="size-4 shrink-0 text-blue-400" strokeWidth={1.75} />
          文档中心内容为静态知识，上传后供所有 Agent 立即使用，不影响正在进行中的任务。
        </div>

      </div>

      {/* ── Upload Modal ── */}
      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onUploaded={() => { fetchCorpus(); setUploadOpen(false) }}
        />
      )}
    </main>
  )
}
