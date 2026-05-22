/**
 * GuidedUploadDrawer — 重构版 v2
 *
 * 新增：全局区上传单个 PDF → 调 /api/analyze → 弹 SplitReviewModal
 * 分类体系（6 类，对齐后端 CATEGORY_FOLDER_MAP）：
 *   院内申报：基本情况表 · 预算清单 · 论证纪要 · 绩效目标表
 *   合规证明：NMPA证 · 价格依据证明
 */

import { useState, useRef, useEffect } from 'react'
import {
  X, Upload, Check, Eye, Sparkles, FileText,
  ClipboardList, ShieldCheck, AlertCircle, Plus,
  ChevronRight, Loader2, ArrowRight, Download, Clock,
  CheckCircle2, Circle, Cpu,
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

// ── 流水线步骤定义（用于进度面板估算）────────────────────────────────────────
// estSecs：该步骤预计耗时（秒），用于时间轴估算，实际以后端状态为准
const PIPELINE_STEPS = [
  { id: 'archive',  label: '归档入库',   desc: '文件物理拆分，写入 case 目录',       estSecs: 0,  stage: 'pre'        },
  { id: 'ingest',   label: '文件结构化', desc: '解析上传材料，提取关键字段',           estSecs: 50, stage: 'ingesting'   },
  { id: 'agent1',   label: '需求分析',   desc: 'Agent1：分析临床需求与立项基础',       estSecs: 30, stage: 'processing'  },
  { id: 'agent2',   label: '竞品对比',   desc: 'Agent2：归并厂家技术参数对比表',       estSecs: 40, stage: 'processing'  },
  { id: 'agent3',   label: '预算测算',   desc: 'Agent3：计算设备全生命周期成本',       estSecs: 25, stage: 'processing'  },
  { id: 'agent4',   label: '收益计算',   desc: 'Agent4：ROI / 投资回收期测算',        estSecs: 25, stage: 'processing'  },
  { id: 'agent5',   label: '合规审查',   desc: 'Agent5：核查证件合规项',              estSecs: 25, stage: 'processing'  },
  { id: 'agent6',   label: '文书生成',   desc: 'Agent6：撰写完整立项建议书正文',      estSecs: 75, stage: 'processing'  },
  { id: 'agent7',   label: '质量评分',   desc: 'Agent7：自审文书质量并评分',          estSecs: 25, stage: 'processing'  },
]
// 各步骤累计耗时（秒）
const STEP_CUMULATIVE = PIPELINE_STEPS.reduce((acc, s, i) => {
  acc.push((acc[i - 1] ?? 0) + s.estSecs)
  return acc
}, [])
const TOTAL_EST_SECS = STEP_CUMULATIVE[STEP_CUMULATIVE.length - 1]

function fmtTime(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}分${s.toString().padStart(2, '0')}秒` : `${s}秒`
}

// ── 分类定义 ──────────────────────────────────────────────────────────────────
const FILE_GROUPS = [
  {
    id: 'internal', title: '院内申报材料', subtitle: '由医院职能部门提供',
    Icon: ClipboardList, accent: 'blue',
    items: [
      { id: 'basic_info',  label: '基本情况表', required: true,  accept: '.pdf,.doc,.docx',        hint: '医院/科室基本情况说明，含床位、诊疗量等核心指标', sampleFile: '医院基本情况表_样例.pdf' },
      { id: 'budget_list', label: '预算清单',   required: true,  accept: '.pdf,.xlsx,.xls,.doc,.docx', hint: '拟申请设备预算项目清单，含型号、数量、单价',     sampleFile: '设备预算项目清单_样例.xlsx' },
      { id: 'minutes',     label: '论证纪要',   required: true,  accept: '.pdf,.doc,.docx',        hint: '预算论证会议纪要，需与会人员签字',               sampleFile: '预算论证会议纪要_样例.pdf' },
      { id: 'performance', label: '绩效目标表', required: true,  accept: '.pdf,.xlsx,.xls,.doc,.docx', hint: '市级绩效申报表，含预期效益与指标',               sampleFile: '绩效目标申报表_样例.pdf' },
    ],
  },
  {
    id: 'compliance', title: '合规证明材料', subtitle: '由厂商或监管部门提供',
    Icon: ShieldCheck, accent: 'violet',
    items: [
      { id: 'nmpa_cert',   label: '医疗器械 NMPA 证', required: false, accept: '.pdf,.jpg,.png',     hint: '国家药监局注册证，确认在有效期内',               sampleFile: 'NMPA注册证_样例.pdf' },
      { id: 'price_proof', label: '价格依据证明',      required: true,  accept: '.pdf,.xlsx,.xls',   hint: '含税报价单或询价记录，至少 1 家厂商',             sampleFile: '价格依据证明_样例.pdf' },
    ],
  },
]

const ALL_ITEMS      = FILE_GROUPS.flatMap((g) => g.items)
const REQUIRED_ITEMS = ALL_ITEMS.filter((i) => i.required)
const TOTAL          = ALL_ITEMS.length

// 文件名关键字（仅用于多文件批量拖入时的前端预判）
const KW_MAP = {
  basic_info:  ['基本情况', '医院概况'],
  budget_list: ['预算', '清单', '预算项目'],
  minutes:     ['纪要', '论证', '会议'],
  nmpa_cert:   ['nmpa', '注册证'],
  price_proof: ['价格', '报价', '询价'],
  performance: ['绩效', '目标', '市级绩效'],
}

const ACCENT = {
  blue:   { groupBg:'bg-blue-50/60',   groupBorder:'border-blue-200',   iconBg:'bg-blue-100',   iconText:'text-blue-500',   headText:'text-blue-700',   countText:'text-blue-600' },
  violet: { groupBg:'bg-violet-50/60', groupBorder:'border-violet-200', iconBg:'bg-violet-100', iconText:'text-violet-500', headText:'text-violet-700', countText:'text-violet-600' },
}

// ── 样例预览弹窗 ──────────────────────────────────────────────────────────────
function SampleModal({ item, onClose }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 flex w-[480px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <FileText className="size-4 text-blue-500" strokeWidth={1.75} />
            <span className="text-[14px] font-semibold text-slate-800">参考样例</span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10.5px] text-slate-500">{item.sampleFile}</span>
          </div>
          <button type="button" onClick={onClose} className="flex size-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-2.5">
          <span className="text-[12px] text-slate-500">{item.label} · {item.hint}</span>
        </div>
        <div className="bg-slate-100 p-5">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="mb-2 h-2.5 rounded-full bg-slate-100" style={{ width: `${50 + Math.sin(i * 1.7) * 38}%` }} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <span className="flex items-center gap-1.5 text-[11.5px] text-amber-600"><AlertCircle className="size-3.5" strokeWidth={2} />仅作格式参考</span>
          <button type="button" onClick={onClose} className="rounded-lg bg-blue-600 px-4 py-1.5 text-[12.5px] font-medium text-white hover:bg-blue-700 transition-colors">关闭</button>
        </div>
      </div>
    </div>
  )
}

// ── AI 拆分确认弹窗 ───────────────────────────────────────────────────────────
function SplitReviewModal({ filename, sections, onConfirm, onCancel }) {
  const categories = ALL_ITEMS.map((i) => ({ id: i.id, label: i.label }))
  const [mappings, setMappings] = useState(() => {
    const m = {}
    sections.forEach((s) => { m[s.start] = s.item_id })
    return m
  })

  const handleConfirm = () => {
    const result = sections.map((s) => ({ ...s, item_id: mappings[s.start] }))
    onConfirm(result)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: '88vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Sparkles className="size-4" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-[13.5px] font-semibold text-slate-800">AI 智能拆分预览</h2>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[260px]">{filename}</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-3 px-5 py-2 bg-slate-50 border-b border-slate-100">
          <div className="flex-1 text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">拆分章节</div>
          <ArrowRight className="size-3 text-slate-300 shrink-0" />
          <div className="w-40 text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">归档分类</div>
        </div>

        {/* Sections */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {sections.map((sec, idx) => (
            <div key={sec.start} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:border-blue-100 hover:bg-blue-50/20 transition-colors group">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 group-hover:bg-blue-100 text-slate-500 group-hover:text-blue-600 text-[11px] font-bold flex items-center justify-center transition-colors">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-medium text-slate-700 truncate">{sec.preview || sec.category_name}</p>
                <p className="text-[10.5px] text-slate-400 mt-0.5">{sec.pages}</p>
              </div>
              <ArrowRight className="size-3 text-slate-300 flex-shrink-0" />
              <select
                value={mappings[sec.start] ?? sec.item_id}
                onChange={(e) => setMappings((prev) => ({ ...prev, [sec.start]: e.target.value }))}
                className="w-40 flex-shrink-0 text-[11.5px] text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent cursor-pointer hover:border-blue-300 transition-colors"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50">
          <p className="text-[11px] text-slate-400">共 {sections.length} 个章节 · 可手动修正后归档</p>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-[12.5px] text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">取消</button>
            <button type="button" onClick={handleConfirm} className="flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200">
              <Check className="size-3.5" strokeWidth={2.5} />
              确认归档入库
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 单行 Dropzone ─────────────────────────────────────────────────────────────
function DropzoneRow({ item, fileState, onUpload, onRemove, onShowSample }) {
  const inputRef = useRef(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const isDone      = fileState?.status === 'done'
  const isUploading = fileState?.status === 'uploading'
  const isError     = fileState?.status === 'error'
  const acceptLabel = item.accept.split(',').map((s) => s.replace('.', '').toUpperCase()).join(' / ')

  return (
    <div className="flex items-center gap-3 py-2.5">
      {/* Status */}
      <div className={['flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-all',
        isDone ? 'border-emerald-500 bg-emerald-500' : isError ? 'border-red-400 bg-red-400' : isUploading ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'].join(' ')}>
        {isDone      && <Check   className="size-2.5 text-white" strokeWidth={3.5} />}
        {isUploading && <Loader2 className="size-2.5 text-blue-500 animate-spin" strokeWidth={3} />}
        {isError     && <X       className="size-2.5 text-white" strokeWidth={3} />}
      </div>

      {/* Label */}
      <div className="w-[196px] shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[12.5px] font-medium text-slate-800">{item.label}</span>
          {item.required
            ? <span className="rounded-[4px] bg-red-50 px-1.5 py-0.5 text-[9.5px] font-bold text-red-500">必填</span>
            : <span className="rounded-[4px] bg-slate-100 px-1.5 py-0.5 text-[9.5px] text-slate-400">选填</span>}
        </div>
        <p className="mt-0.5 text-[10.5px] leading-tight text-slate-400">{item.hint}</p>
        <button type="button" onClick={() => onShowSample(item)}
          className="mt-0.5 flex items-center gap-0.5 text-[11px] font-medium text-blue-500 hover:text-blue-700 transition-colors">
          <Eye className="size-3" strokeWidth={2} />参考样例
        </button>
      </div>

      {/* Right zone */}
      {isDone ? (
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <FileText className="size-3.5 shrink-0 text-emerald-500" strokeWidth={1.75} />
              <span className="truncate text-[12px] font-medium text-emerald-700">{fileState.savedAs || fileState.name}</span>
            </div>
            <button type="button" onClick={() => onRemove(item.id)}
              className="shrink-0 rounded-md p-1 text-emerald-300 hover:bg-white/60 hover:text-red-500 transition-colors">
              <X className="size-3.5" strokeWidth={2.5} />
            </button>
          </div>
          {fileState.fromSplit && (
            <span className="ml-1 flex items-center gap-1 text-[10.5px] text-blue-500">
              <Sparkles className="size-3" strokeWidth={2} />
              AI 拆分归档 · {fileState.pages}
              {fileState.sizeKb ? ` · ${fileState.sizeKb} KB` : ''}
              {fileState.jobId ? (
                <span className="ml-1 font-mono text-[9.5px] text-slate-400 bg-slate-100 px-1 rounded">
                  #{fileState.jobId.slice(0, 8)}
                </span>
              ) : null}
            </span>
          )}
        </div>
      ) : isUploading ? (
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-[9px]">
          <Loader2 className="size-3.5 text-blue-400 animate-spin" strokeWidth={2} />
          <span className="text-[12px] text-blue-500">上传中，MriAgent 正在识别…</span>
        </div>
      ) : isError ? (
        <div className="flex flex-1 items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-[9px]">
          <span className="truncate text-[12px] text-red-500">{fileState.message}</span>
          <button type="button" onClick={() => onRemove(item.id)} className="shrink-0 text-[11px] text-red-400 hover:text-red-600 underline transition-colors">重试</button>
        </div>
      ) : (
        <div role="button" tabIndex={0}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) onUpload(item.id, f) }}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          className={['flex flex-1 cursor-pointer select-none items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-[9px] text-[12px] transition-all',
            isDragOver ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-slate-200 bg-white text-slate-400 hover:border-blue-300 hover:bg-blue-50/30 hover:text-blue-500'].join(' ')}>
          <span className="flex items-center gap-1.5">
            <Upload className="size-3.5 shrink-0" strokeWidth={1.75} />
            {isDragOver ? '松开以上传' : '拖入或点击上传'}
          </span>
          <span className="text-[10px] text-slate-300">{acceptLabel}</span>
        </div>
      )}
      <input ref={inputRef} type="file" accept={item.accept} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(item.id, f); e.target.value = '' }} />
    </div>
  )
}

// ── 主抽屉 ────────────────────────────────────────────────────────────────────
export default function GuidedUploadDrawer({ isOpen, onClose, onSubmit, activeCaseId }) {
  const [fileStates,        setFileStates]        = useState({})
  const [isDragOverAll,     setIsDragOverAll]     = useState(false)
  const [isAnalyzing,       setIsAnalyzing]       = useState(false)
  const [splitData,         setSplitData]         = useState(null)
  const [sampleItem,        setSampleItem]        = useState(null)
  const [lastJobId,         setLastJobId]         = useState(null)
  const [hospitalName,      setHospitalName]      = useState('')        // 医院/项目名称
  const [caseId,            setCaseId]            = useState(null)      // 当前 case UUID
  const [pipelineStatus,    setPipelineStatus]    = useState(null)      // null | 'running' | 'done' | 'error'
  const [pipelineError,     setPipelineError]     = useState(null)
  const [pipelineStage,     setPipelineStage]     = useState(null)      // 'ingesting' | 'processing'
  const [view,              setView]              = useState('upload')  // 'upload' | 'pipeline'
  const [elapsedSecs,       setElapsedSecs]       = useState(0)
  const [processingStartSecs, setProcessingStartSecs] = useState(null) // elapsed secs when processing began
  const [restored,          setRestored]          = useState(false)     // 是否已从后端恢复上传进度
  const globalRef    = useRef(null)
  const pollTimerRef = useRef(null)
  const tickerRef    = useRef(null)

  // ── 抽屉打开 OR 外部项目切换：统一加载对应项目状态（单一 effect，消除竞争）──────
  useEffect(() => {
    if (!isOpen) return

    // activeCaseId = null → 新建模式，直接展示空白表单，不加载任何已有项目
    if (!activeCaseId) {
      setCaseId(null)
      setHospitalName('')
      setFileStates({})
      setRestored(false)
      setView('upload')
      setPipelineStatus(null); setPipelineStage(null); setPipelineError(null)
      setElapsedSecs(0); setProcessingStartSecs(null)
      return
    }

    ;(async () => {
      try {
        let targetCase = null

        // 加载指定项目的状态
        const res = await fetch(`${API_BASE}/api/cases/${activeCaseId}`)
        if (!res.ok) return
        targetCase = await res.json()

        const { status, case_id, hospital_name } = targetCase

        setCaseId(case_id)
        setHospitalName(hospital_name || '')

        if (['ready', 'ingesting', 'processing', 'done', 'error'].includes(status)) {
          // 流水线已启动 → 进度视图
          setView('pipeline')
          if (status === 'done') {
            setPipelineStatus('done'); setPipelineStage('processing')
          } else if (status === 'error') {
            setPipelineStatus('error')
            setPipelineError('该项目执行出错，可重试或重新上传')
          } else {
            setPipelineStatus('running')
            setPipelineStage(status === 'processing' ? 'processing' : 'ingesting')
          }
        } else {
          // 上传中 / 新建 → 上传视图，恢复文件列表
          setView('upload')
          setPipelineStatus(null); setPipelineStage(null); setPipelineError(null)
          setElapsedSecs(0); setProcessingStartSecs(null)

          const r2 = await fetch(`${API_BASE}/api/cases/${case_id}/files`)
          if (r2.ok) {
            const existing = await r2.json()
            const keys = Object.keys(existing)
            if (keys.length > 0) {
              const restoredFiles = {}
              keys.forEach((itemId) => {
                const info = existing[itemId]
                restoredFiles[itemId] = {
                  status: 'done', name: info.saved_as, savedAs: info.saved_as,
                  sizeKb: info.size_kb, fromBackend: true,
                }
              })
              setFileStates(restoredFiles)
              setRestored(true)
            } else {
              setFileStates({})
              setRestored(false)
            }
          } else {
            setFileStates({})
            setRestored(false)
          }
        }
      } catch (_) {}
    })()
  }, [isOpen, activeCaseId])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── 1秒计时器（进度面板已用时）──────────────────────────────────────────────
  useEffect(() => {
    if (view === 'pipeline' && pipelineStatus === 'running') {
      tickerRef.current = setInterval(() => setElapsedSecs((n) => n + 1), 1000)
    } else {
      clearInterval(tickerRef.current)
    }
    return () => clearInterval(tickerRef.current)
  }, [view, pipelineStatus])

  // ── 记录 processing 开始的已用秒数 ────────────────────────────────────────
  useEffect(() => {
    if (pipelineStage === 'processing' && processingStartSecs === null) {
      setProcessingStartSecs(elapsedSecs)
    }
  }, [pipelineStage])

  // 抽屉关闭后重置（pipeline 未启动时才重置，避免打断进行中的流水线）
  useEffect(() => {
    if (!isOpen && view !== 'pipeline') {
      setFileStates({})
      setHospitalName('')
      setCaseId(null)
      setView('upload')
      setElapsedSecs(0)
      setProcessingStartSecs(null)
      setPipelineStatus(null)
      setPipelineStage(null)
      setPipelineError(null)
      setRestored(false)
    }
  }, [isOpen])

  const doneCnt         = Object.values(fileStates).filter((s) => s?.status === 'done').length
  const requiredFilled  = REQUIRED_ITEMS.every((i) => fileStates[i.id]?.status === 'done')
  const pct             = Math.round((doneCnt / TOTAL) * 100)
  const missingRequired = REQUIRED_ITEMS.filter((i) => fileStates[i.id]?.status !== 'done').length

  // ── 单文件精准上传 ─────────────────────────────────────────────────────────
  async function uploadToBackend(itemId, file) {
    const id = await ensureCaseId()   // 直接用返回值，不依赖 React state（setState 异步）
    if (!id) {
      setFileStates((prev) => ({ ...prev, [itemId]: { status: 'error', message: '无法建立 case，请检查后端是否启动' } }))
      return
    }
    setFileStates((prev) => ({ ...prev, [itemId]: { status: 'uploading', name: file.name } }))
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('category', itemId)
      const res = await fetch(`${API_BASE}/api/cases/${id}/upload`, { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: '上传失败' }))
        throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail))
      }
      const data = await res.json()
      setFileStates((prev) => ({ ...prev, [itemId]: { status: 'done', name: file.name, savedAs: data.saved_as } }))
    } catch (err) {
      setFileStates((prev) => ({ ...prev, [itemId]: { status: 'error', message: err.message || '上传出错' } }))
    }
  }

  // ── 打开抽屉时建立新 case ─────────────────────────────────────────────────
  async function ensureCaseId() {
    if (caseId) return caseId
    try {
      const form = new FormData()
      form.append('hospital_name', hospitalName.trim())   // 始终附带，即使为空
      const res = await fetch(`${API_BASE}/api/cases`, { method: 'POST', body: form })
      if (!res.ok) throw new Error('建立 case 失败')
      const data = await res.json()
      setCaseId(data.case_id)
      return data.case_id
    } catch (e) {
      console.error('[MriAgent] create case failed:', e)
      return null
    }
  }

  // ── 触发 ingest → 7-agent 流水线 ──────────────────────────────────────────
  async function startPipeline(activeCaseId) {
    const id = activeCaseId || caseId
    if (!id) return
    // 启动前兜底保存医院名（避免 case 创建时名字还未填写的情况）
    if (hospitalName.trim()) {
      try {
        const form = new FormData()
        form.append('hospital_name', hospitalName.trim())
        await fetch(`${API_BASE}/api/cases/${id}`, { method: 'PATCH', body: form })
      } catch (_) {}
    }
    setPipelineStatus('running')
    setPipelineStage('ingesting')
    setPipelineError(null)
    try {
      const res = await fetch(`${API_BASE}/api/cases/${id}/run`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: '启动失败' }))
        throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail))
      }
      // 开始轮询状态
      pollTimerRef.current = setInterval(async () => {
        try {
          const r = await fetch(`${API_BASE}/api/cases/${id}`)
          const meta = await r.json()
          // 同步 stage 状态
          if (meta.status === 'ingesting')  setPipelineStage('ingesting')
          if (meta.status === 'processing') setPipelineStage('processing')
          if (meta.status === 'done') {
            clearInterval(pollTimerRef.current)
            setPipelineStage('processing')  // 全部完成
            setPipelineStatus('done')
          } else if (meta.status === 'error') {
            clearInterval(pollTimerRef.current)
            setPipelineStatus('error')
            setPipelineError(meta.error || '流水线执行出错')
          }
        } catch (_) {}
      }, 3000)
    } catch (err) {
      setPipelineStatus('error')
      setPipelineError(err.message)
    }
  }

  function handleSubmit() {
    if (!requiredFilled) return
    // 切换到进度面板视图，不关闭抽屉
    setView('pipeline')
    setElapsedSecs(0)
    setProcessingStartSecs(null)
    const activeCaseId = caseId
    startPipeline(activeCaseId)
    // 注意：不在此处调用 onSubmit，避免外部（如 CenterPanel）的回调把抽屉关掉。
    // pipeline 完成后用户可自行点击「关闭」或「新建项目」。
  }

  function handleRemove(itemId) {
    setFileStates((prev) => { const n = { ...prev }; delete n[itemId]; return n })
  }

  // ── 全局区：单 PDF → 分析；多文件 → 批量关键词分类上传 ────────────────────
  async function handleGlobalFiles(fileList) {
    if (fileList.length === 1 && fileList[0].name.toLowerCase().endsWith('.pdf')) {
      // 走 AI 解析流程
      const file = fileList[0]
      setIsAnalyzing(true)
      try {
        const id = await ensureCaseId()   // 直接用返回值
        const form = new FormData()
        form.append('file', file)
        const res = await fetch(`${API_BASE}/api/cases/${id}/analyze`, { method: 'POST', body: form })
        if (!res.ok) throw new Error('解析失败，请检查后端服务')
        const data = await res.json()
        setSplitData({ filename: file.name, sections: data.sections, rawFile: file })
      } catch (err) {
        // 降级：直接按文件名分类上传
        classifyAndUploadAll(fileList)
      } finally {
        setIsAnalyzing(false)
      }
    } else {
      classifyAndUploadAll(fileList)
    }
  }

  // 多文件批量关键词分类
  function classifyAndUploadAll(fileList) {
    const assigned = {}
    const unmatched = []
    fileList.forEach((file) => {
      const name = file.name.toLowerCase()
      let matched = false
      for (const [id, kws] of Object.entries(KW_MAP)) {
        if (kws.some((kw) => name.includes(kw))) {
          if (!fileStates[id] && !assigned[id]) { assigned[id] = file; matched = true; break }
        }
      }
      if (!matched) unmatched.push(file)
    })
    for (const file of unmatched) {
      for (const item of ALL_ITEMS) {
        if (!fileStates[item.id] && !assigned[item.id]) { assigned[item.id] = file; break }
      }
    }
    Object.entries(assigned).forEach(([id, file]) => uploadToBackend(id, file))
  }

  // ── 调 /api/split：物理拆分 + job_id 追踪 ─────────────────────────────────
  async function handleSplitConfirm(confirmedSections) {
    const capturedSplitData = splitData
    setSplitData(null)   // 先关弹窗

    // 乐观 UI：命中分类先置 uploading
    const optimistic = {}
    confirmedSections.forEach((sec) => {
      if (!optimistic[sec.item_id])
        optimistic[sec.item_id] = { status: 'uploading', name: capturedSplitData.filename }
    })
    setFileStates((prev) => ({ ...prev, ...optimistic }))

    try {
      const id = await ensureCaseId()   // 直接用返回值
      if (!id) throw new Error('无法建立 case，请检查后端')
      const form = new FormData()
      form.append('file', capturedSplitData.rawFile)
      form.append('sections', JSON.stringify(confirmedSections))

      const res = await fetch(`${API_BASE}/api/cases/${id}/split`, { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: '拆分失败' }))
        throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail))
      }

      const data = await res.json()
      // data.job_id  — 本次任务唯一 ID
      // data.files[] — 每个分段的落盘信息

      const updates = {}
      data.files.forEach((f) => {
        updates[f.item_id] = {
          status:    'done',
          name:      capturedSplitData.filename,
          savedAs:   f.saved_as,
          pages:     f.pages,
          sizeKb:    f.size_kb,
          jobId:     data.job_id,
          folder:    f.folder,
          fromSplit: true,
        }
      })
      setFileStates((prev) => ({ ...prev, ...updates }))
      setLastJobId(data.job_id)
    } catch (err) {
      const errUpdates = {}
      confirmedSections.forEach((sec) => {
        errUpdates[sec.item_id] = { status: 'error', message: err.message || '拆分上传失败' }
      })
      setFileStates((prev) => ({ ...prev, ...errUpdates }))
    }
  }

  function handleGlobalDrop(e) {
    e.preventDefault(); setIsDragOverAll(false)
    const list = Array.from(e.dataTransfer?.files ?? [])
    if (list.length) handleGlobalFiles(list)
  }

  function handleGlobalChange(e) {
    const list = Array.from(e.target.files ?? [])
    if (list.length) handleGlobalFiles(list)
    e.target.value = ''
  }



  // ── 当前步骤索引（基于状态+已用时间估算）──────────────────────────────────
  const currentStepIdx = (() => {
    if (pipelineStatus === 'done') return PIPELINE_STEPS.length   // all done
    if (!pipelineStatus || pipelineStatus === 'error') return 0
    if (pipelineStage === 'ingesting') return 1  // ingest step active
    if (pipelineStage === 'processing') {
      // 估算 processing 内部走到哪个 agent
      const procElapsed = processingStartSecs !== null ? elapsedSecs - processingStartSecs : 0
      // processing steps are index 2..8
      let cum = 0
      for (let i = 2; i < PIPELINE_STEPS.length; i++) {
        cum += PIPELINE_STEPS[i].estSecs
        if (procElapsed < cum) return i
      }
      return PIPELINE_STEPS.length - 1
    }
    return 1
  })()

  const estRemaining = Math.max(0, TOTAL_EST_SECS - elapsedSecs)
  const pctDone = Math.min(100, Math.round((elapsedSecs / TOTAL_EST_SECS) * 100))

  return (
    <>
      {/* Backdrop — pipeline 视图时不可点击关闭 */}
      <div className={['fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] transition-opacity duration-300', isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'].join(' ')}
        onClick={view === 'upload' ? onClose : undefined} />

      {/* Drawer */}
      <div className={['fixed right-0 top-0 z-50 flex h-full w-[700px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out', isOpen ? 'translate-x-0' : 'translate-x-full'].join(' ')}>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={['flex size-9 shrink-0 items-center justify-center rounded-xl shadow-md',
              view === 'pipeline' ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-200' : 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-200'].join(' ')}>
              {view === 'pipeline' ? <Cpu className="size-5 text-white" strokeWidth={2} /> : <Plus className="size-5 text-white" strokeWidth={2.5} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-bold text-slate-900">
                  {view === 'pipeline' ? 'AI 智能测算进行中' : '新建立项论证任务'}
                </h2>
                {view === 'upload' && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600">{TOTAL} 类标准材料</span>}
                {view === 'pipeline' && pipelineStatus === 'running' && (
                  <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600">
                    <Loader2 className="size-3 animate-spin" />已用时 {fmtTime(elapsedSecs)}
                  </span>
                )}
                {view === 'pipeline' && pipelineStatus === 'done' && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                    <Check className="size-3" strokeWidth={3} />全部完成，用时 {fmtTime(elapsedSecs)}
                  </span>
                )}
              </div>
              <p className="text-[12px] text-slate-400">
                {view === 'pipeline' ? `7个 AI Agent 依次运行中，预计总耗时约 ${fmtTime(TOTAL_EST_SECS)}` : '上传后 MriAgent 自动解析并填充立项论证报告'}
              </p>
            </div>
          </div>
          {/* pipeline 运行中隐藏关闭按钮，避免误关 */}
          {(view !== 'pipeline' || pipelineStatus !== 'running') && (
            <button type="button" onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
              <X className="size-5" strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">

          {/* ══ Pipeline 进度视图 ══════════════════════════════════════════════ */}
          {view === 'pipeline' && (
            <div className="flex flex-1 flex-col px-6 py-6 gap-5">

              {/* 总进度条 */}
              {pipelineStatus === 'running' && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[12px]">
                    <span className="font-medium text-slate-600">整体进度（预估）</span>
                    <span className="tabular-nums text-slate-400">预计还需 {fmtTime(estRemaining)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-1000 ease-linear"
                      style={{ width: `${pctDone}%` }} />
                  </div>
                </div>
              )}
              {pipelineStatus === 'done' && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 shadow-md shadow-emerald-200">
                      <Check className="size-5 text-white" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[14px] font-bold text-emerald-800">立项建议书已生成</p>
                      <p className="text-[12px] text-emerald-600">7个 Agent 全部完成，docx 文件已就绪</p>
                      {hospitalName && <p className="mt-0.5 text-[11.5px] text-emerald-500">项目：{hospitalName}</p>}
                    </div>
                    <a href={`${API_BASE}/api/cases/${caseId}/document`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors">
                      <Download className="size-4" strokeWidth={2} />查看文档
                    </a>
                  </div>
                  {/* 重跑入口：环境变量更新后可重新生成更完整的报告 */}
                  <div className="mt-3 flex items-center justify-between border-t border-emerald-100 pt-3">
                    <p className="text-[11.5px] text-emerald-600">如已更新 API Key，可重新运行以生成完整报告</p>
                    <button type="button"
                      onClick={() => {
                        if (caseId) {
                          setPipelineStatus('running')
                          setPipelineStage('ingesting')
                          setPipelineError(null)
                          setElapsedSecs(0)
                          setProcessingStartSecs(null)
                          startPipeline(caseId)
                        }
                      }}
                      className="shrink-0 ml-3 flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[12px] font-medium text-emerald-700 hover:bg-emerald-50 transition-colors">
                      🔄 重新运行流水线
                    </button>
                  </div>
                </div>
              )}
              {pipelineStatus === 'error' && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
                  <p className="text-[13px] font-semibold text-red-700">流水线执行出错</p>
                  <p className="mt-1 text-[12px] text-red-500 font-mono break-all leading-relaxed">{pipelineError}</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button"
                      onClick={() => {
                        // 重试：用当前 caseId 直接重跑流水线
                        if (caseId) {
                          setPipelineStatus('running')
                          setPipelineStage('ingesting')
                          setPipelineError(null)
                          setElapsedSecs(0)
                          setProcessingStartSecs(null)
                          startPipeline(caseId)
                        }
                      }}
                      className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-red-700 transition-colors">
                      重试流水线
                    </button>
                    <button type="button"
                      onClick={() => {
                        // 重新上传：清空状态回到上传视图
                        setView('upload')
                        setFileStates({})
                        setCaseId(null)
                        setPipelineStatus(null)
                        setPipelineStage(null)
                        setPipelineError(null)
                        setElapsedSecs(0)
                        setProcessingStartSecs(null)
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50 transition-colors">
                      重新上传文件
                    </button>
                  </div>
                </div>
              )}

              {/* 步骤列表 */}
              <div className="flex-1 overflow-y-auto">
                <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">执行步骤</p>
                <div className="flex flex-col gap-0">
                  {PIPELINE_STEPS.map((step, idx) => {
                    const isDone    = pipelineStatus === 'done' ? true : idx < currentStepIdx
                    const isActive  = !isDone && idx === currentStepIdx && pipelineStatus === 'running'
                    const isPending = !isDone && !isActive

                    return (
                      <div key={step.id} className="relative flex items-start gap-3 py-3">
                        {/* connector line */}
                        {idx < PIPELINE_STEPS.length - 1 && (
                          <div className={['absolute left-[13px] top-9 bottom-0 w-0.5', isDone ? 'bg-emerald-200' : 'bg-slate-100'].join(' ')} />
                        )}
                        {/* icon */}
                        <div className={['relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500',
                          isDone    ? 'border-emerald-400 bg-emerald-50'  :
                          isActive  ? 'border-blue-400 bg-blue-50 ring-4 ring-blue-100' :
                                      'border-slate-200 bg-white'].join(' ')}>
                          {isDone
                            ? <Check className="size-3.5 text-emerald-500" strokeWidth={3} />
                            : isActive
                            ? <Loader2 className="size-3.5 text-blue-500 animate-spin" strokeWidth={2.5} />
                            : <Circle className="size-2 text-slate-300" />}
                        </div>
                        {/* text */}
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center gap-2">
                            <span className={['text-[13px] font-semibold',
                              isDone ? 'text-emerald-700' : isActive ? 'text-blue-700' : 'text-slate-400'].join(' ')}>
                              {step.label}
                            </span>
                            {isActive && (
                              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">进行中</span>
                            )}
                            {isDone && idx > 0 && (
                              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">完成</span>
                            )}
                            {step.estSecs > 0 && isPending && (
                              <span className="text-[10px] text-slate-300">约 {step.estSecs}s</span>
                            )}
                          </div>
                          <p className={['text-[11.5px] mt-0.5', isDone || isActive ? 'text-slate-500' : 'text-slate-300'].join(' ')}>
                            {step.desc}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 底部按钮区 */}
              <div className="flex shrink-0 items-center justify-between border-t border-slate-100 pt-4">
                {pipelineStatus === 'done'
                  ? <div className="flex items-center gap-2">
                      <button type="button" onClick={() => { setView('upload'); onClose?.() }}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                        关闭
                      </button>
                      <button type="button"
                        onClick={() => {
                          // 完全重置，开始全新项目
                          setView('upload')
                          setFileStates({})
                          setCaseId(null)
                          setHospitalName('')
                          setPipelineStatus(null)
                          setPipelineStage(null)
                          setPipelineError(null)
                          setElapsedSecs(0)
                          setProcessingStartSecs(null)
                        }}
                        className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-[13px] font-medium text-blue-600 hover:bg-blue-100 transition-colors">
                        <Plus className="size-3.5" strokeWidth={2.5} />新建项目
                      </button>
                    </div>
                  : <span className="text-[12px] text-slate-400 flex items-center gap-1.5">
                      <Clock className="size-3.5" />已运行 {fmtTime(elapsedSecs)}
                    </span>
                }
                {pipelineStatus === 'done' && (
                  <a href={`${API_BASE}/api/cases/${caseId}/document`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-[13px] font-semibold text-white shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors">
                    <Download className="size-4" strokeWidth={2} />下载立项建议书.docx
                  </a>
                )}
              </div>
            </div>
          )}

          {/* ══ 上传视图（默认）══════════════════════════════════════════════ */}
          {view === 'upload' && (<>

          {/* 医院 / 项目名称 */}
          <div className="px-6 pt-5 pb-0">
            <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-slate-600">
              医院 / 项目名称
              <span className="rounded bg-red-50 px-1 py-0.5 text-[9px] font-bold text-red-500">必填</span>
            </label>
            <input
              type="text"
              value={hospitalName}
              onChange={(e) => {
                const val = e.target.value
                setHospitalName(val)
                // 若 case 已存在，实时保存医院名到后端（防抖 800ms）
                if (caseId) {
                  clearTimeout(window.__mriHospitalSaveTimer)
                  window.__mriHospitalSaveTimer = setTimeout(async () => {
                    try {
                      const form = new FormData()
                      form.append('hospital_name', val.trim())
                      await fetch(`${API_BASE}/api/cases/${caseId}`, { method: 'PATCH', body: form })
                    } catch (_) {}
                  }, 800)
                }
              }}
              placeholder="例：31**** 放射科 3.0T MRI 新增立项"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13.5px] text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* 已恢复提示 */}
          {restored && (
            <div className="mx-6 mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" strokeWidth={2} />
              <span className="flex-1 text-[12.5px] text-emerald-700">已自动恢复上次上传的文件，可继续补充剩余材料</span>
              <button
                type="button"
                onClick={() => setRestored(false)}
                className="text-emerald-400 hover:text-emerald-600 transition-colors"
              >
                <X className="size-3.5" strokeWidth={2} />
              </button>
            </div>
          )}

          {/* 全局智能区 */}
          <div className="px-6 pt-4 pb-3">
            <div role="button" tabIndex={0}
              onDragOver={(e) => { e.preventDefault(); setIsDragOverAll(true) }}
              onDragLeave={() => setIsDragOverAll(false)}
              onDrop={handleGlobalDrop}
              onClick={() => globalRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && globalRef.current?.click()}
              className={['relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed px-5 py-4 transition-all duration-200',
                isDragOverAll ? 'border-blue-400 bg-blue-50/80 shadow-inner' : isAnalyzing ? 'border-blue-300 bg-blue-50/60' : 'border-slate-200 bg-gradient-to-br from-blue-50/50 via-white to-violet-50/30 hover:border-blue-300'].join(' ')}>
              <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
                style={{ backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
              <div className="relative flex items-center gap-4">
                <div className={['flex size-11 shrink-0 items-center justify-center rounded-xl shadow-lg transition-transform duration-200',
                  isDragOverAll ? 'scale-110 bg-blue-500 shadow-blue-200' : 'bg-gradient-to-br from-blue-500 to-violet-500 shadow-blue-100'].join(' ')}>
                  {isAnalyzing
                    ? <Loader2 className="size-5 text-white animate-spin" strokeWidth={2} />
                    : <Sparkles className="size-5 text-white" strokeWidth={2} />}
                </div>
                <div className="flex-1">
                  <p className="text-[13.5px] font-semibold text-slate-800">
                    全局智能识别区
                    <span className="ml-1.5 rounded-md bg-gradient-to-r from-blue-100 to-violet-100 px-1.5 py-0.5 text-[10.5px] font-bold text-blue-600">AI 自动分类</span>
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
                    {isAnalyzing
                      ? 'MriAgent 正在读取 PDF 结构，识别各章节边界…'
                      : <>拖入<span className="font-semibold text-slate-700">完整合集 PDF</span>，AI 自动拆分各章节并弹窗确认归档</>}
                  </p>
                </div>
                <div className={['shrink-0 rounded-xl border px-3.5 py-2 text-[12px] font-medium transition-all',
                  isDragOverAll ? 'border-blue-300 bg-white text-blue-600 shadow-sm' : 'border-slate-200 bg-white/80 text-slate-500'].join(' ')}>
                  {isDragOverAll ? '✨ 松开即可' : isAnalyzing ? '解析中…' : '拖入 · 多选上传'}
                </div>
              </div>
            </div>
            <input ref={globalRef} type="file" multiple className="hidden" onChange={handleGlobalChange} />
          </div>

          {/* 分割线 */}
          <div className="flex items-center gap-3 px-6 pb-3">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <ChevronRight className="size-3 text-slate-300" />或按分类逐项上传<ChevronRight className="size-3 text-slate-300" />
            </span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          {/* 分类列表 */}
          <div className="flex flex-col gap-3 px-6 pb-5">
            {FILE_GROUPS.map((group) => {
              const ac = ACCENT[group.accent]
              const GroupIcon = group.Icon
              const groupDone = group.items.filter((i) => fileStates[i.id]?.status === 'done').length
              return (
                <div key={group.id} className={`overflow-hidden rounded-2xl border ${ac.groupBorder} ${ac.groupBg}`}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${ac.iconBg}`}>
                        <GroupIcon className={`size-4 ${ac.iconText}`} strokeWidth={1.75} />
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-[13px] font-semibold ${ac.headText}`}>{group.title}</span>
                        <span className="text-[11.5px] text-slate-400">{group.subtitle}</span>
                      </div>
                    </div>
                    <span className={['rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold', groupDone === group.items.length ? 'bg-emerald-100 text-emerald-600' : `${ac.groupBg} ${ac.countText}`].join(' ')}>
                      {groupDone === group.items.length ? '✓ 已完成' : `${groupDone} / ${group.items.length}`}
                    </span>
                  </div>
                  <div className={`mx-4 border-t ${ac.groupBorder} opacity-30`} />
                  <div className="flex flex-col divide-y divide-white/60 px-4">
                    {group.items.map((item) => (
                      <DropzoneRow key={item.id} item={item} fileState={fileStates[item.id] ?? null}
                        onUpload={uploadToBackend} onRemove={handleRemove} onShowSample={setSampleItem} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          </>)}
        </div>

        {/* Footer — 仅上传视图显示 */}
        {view === 'upload' && (
        <div className="shrink-0 border-t border-slate-100 bg-white px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <span className="text-[13px] font-semibold text-slate-700">
                  已集齐&nbsp;<span className={doneCnt > 0 ? 'text-blue-600' : 'text-slate-400'}>{doneCnt}</span>
                  <span className="text-slate-400">/{TOTAL}</span>&nbsp;份核心材料
                </span>
                {missingRequired > 0
                  ? <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600"><AlertCircle className="size-3" strokeWidth={2.5} />{missingRequired} 项必填未完成</span>
                  : <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600"><Check className="size-3" strokeWidth={3} />必填项已集齐</span>}
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-44 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] tabular-nums text-slate-400">{pct}%</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors">稍后再说</button>
              <button type="button" onClick={handleSubmit}
                disabled={!requiredFilled}
                className={['flex items-center gap-2 rounded-xl px-5 py-2 text-[13px] font-semibold transition-all duration-200',
                  requiredFilled ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95'
                                 : 'cursor-not-allowed bg-slate-100 text-slate-400'].join(' ')}>
                <Sparkles className={`size-4 ${requiredFilled ? '' : 'opacity-40'}`} strokeWidth={2} />
                开始 AI 智能测算
              </button>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* AI 拆分确认弹窗 */}
      {splitData && (
        <SplitReviewModal
          filename={splitData.filename}
          sections={splitData.sections}
          onConfirm={handleSplitConfirm}
          onCancel={() => setSplitData(null)}
        />
      )}

      {/* 样例预览弹窗 */}
      {sampleItem && <SampleModal item={sampleItem} onClose={() => setSampleItem(null)} />}
    </>
  )
}
