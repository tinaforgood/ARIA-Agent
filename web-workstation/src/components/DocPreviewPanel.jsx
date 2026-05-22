import { ExternalLink, FileSpreadsheet, FileText, FileType2, Sparkles, X } from 'lucide-react'

import { UploadedBadge } from '@/components/ui/UploadedBadge'

function getFilesApiOrigin() {
  const explicit = import.meta.env.VITE_FILES_API_ORIGIN
  if (typeof explicit === 'string' && explicit.trim()) return explicit.replace(/\/$/, '')
  const snap = import.meta.env.VITE_SNAPSHOT_API_URL ?? 'http://localhost:8000/api/snapshot'
  try {
    return new URL(snap).origin
  } catch {
    return 'http://localhost:8000'
  }
}

function encodePathSegments(relPath) {
  return relPath
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/')
}

/** Map ConflictableField-style origin to datasource top-level folder */
function originTypeToFolder(originType) {
  if (!originType) return null
  const t = String(originType)
  if (t === 'agent_corpus') return 'agent_corpus'
  if (t === 'user_upload' || t === 'user_uploads') return 'user_uploads'
  return null
}

function displayFileName(doc) {
  return doc.fileName ?? doc.file_name ?? ''
}

function resolveSummaryBody(doc) {
  const raw = doc.summary
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  return '当前文档暂无内容摘要'
}

/**
 * Build GET URL for `/files/...` static mount.
 * @param {import('@/pages/MaterialFlow/docTypes').PreviewDoc} doc
 */
export function resolvePreviewFileUrl(doc) {
  if (doc.previewUrl || doc.fileUrl) return doc.previewUrl ?? doc.fileUrl ?? null
  const origin = getFilesApiOrigin()

  if (doc.relativePath && typeof doc.relativePath === 'string') {
    return `${origin}/files/${encodePathSegments(doc.relativePath)}`
  }

  const root = doc.originRoot ?? originTypeToFolder(doc.origin_type)
  const cat = doc.categoryDir ?? doc.doc_category ?? ''
  const fn = displayFileName(doc)
  if (!root || !fn) return null
  const segments = [root, cat, fn].filter(Boolean)
  return `${origin}/files/${segments.map(encodeURIComponent).join('/')}`
}

function extensionOf(name) {
  if (!name || typeof name !== 'string') return ''
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

/**
 * @param {{ doc: import('@/pages/MaterialFlow/docTypes').PreviewDoc; fileUrl: string; ext: string }} props
 */
function OfficeAiSummaryPreview({ doc, fileUrl, ext }) {
  const fullName = displayFileName(doc)
  const isExcel = ext === 'xlsx' || ext === 'xls'
  const isPpt = ext === 'pptx' || ext === 'ppt'
  const summaryText = resolveSummaryBody(doc)

  const iconWrap =
    isExcel
      ? 'bg-emerald-50 ring-emerald-200/60 shadow-emerald-900/5'
      : isPpt
        ? 'bg-amber-50 ring-amber-200/60 shadow-amber-900/5'
        : 'bg-blue-50 ring-blue-200/60 shadow-blue-900/5'

  return (
    <div className="flex h-full min-h-0 flex-1 items-stretch justify-center overflow-hidden p-4 sm:p-5">
      <div className="flex w-full max-w-xl flex-col justify-center">
        <div className="rounded-2xl border border-slate-200/90 bg-white/80 shadow-xl shadow-slate-900/[0.06] ring-1 ring-white/70 backdrop-blur-md">
          <div className="border-b border-slate-100/90 bg-gradient-to-r from-slate-50/95 to-white/90 px-5 py-4 backdrop-blur-sm">
            <div className="flex items-start gap-4">
              <div
                className={`flex size-14 shrink-0 items-center justify-center rounded-xl shadow-md ring-1 ${iconWrap}`}
              >
                {isExcel ? (
                  <FileSpreadsheet className="size-8 text-emerald-600" strokeWidth={1.5} />
                ) : isPpt ? (
                  <FileText className="size-8 text-amber-600" strokeWidth={1.5} />
                ) : (
                  <FileText className="size-8 text-blue-600" strokeWidth={1.5} />
                )}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {isExcel ? 'Excel 工作簿' : isPpt ? '演示文稿' : 'Word 文档'}
                </p>
                <p className="mt-1 break-words text-sm font-semibold leading-snug text-slate-900">
                  {fullName || '未命名文件'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 px-5 py-5">
            <div className="rounded-xl border border-blue-100/90 bg-gradient-to-br from-blue-50/95 via-sky-50/60 to-indigo-50/40 p-4 shadow-inner ring-1 ring-blue-100/50">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-white/90 shadow-sm ring-1 ring-amber-100/80">
                  <Sparkles className="size-4 text-amber-500" strokeWidth={2} aria-hidden />
                </span>
                <h4 className="text-sm font-semibold tracking-tight text-slate-800">AI 智能摘要</h4>
              </div>
              <p className="text-[13px] leading-[1.65] text-slate-700">{summaryText}</p>
            </div>

            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800 hover:shadow-xl active:scale-[0.99]"
            >
              <span aria-hidden className="text-base leading-none">
                📥
              </span>
              下载 / 打开原文件
              <ExternalLink className="size-4 opacity-80" aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Slide-out: document meta + Agent extraction + live preview (PDF iframe / Office AI summary).
 * @param {{
 *   doc: import('@/pages/MaterialFlow/docTypes').PreviewDoc
 *   onClose: () => void
 * }} props
 */
export function DocPreviewPanel({ doc, onClose }) {
  const fileUrl = resolvePreviewFileUrl(doc)
  const fullName = displayFileName(doc)
  const ext = extensionOf(fullName)
  const isPdf = ext === 'pdf'
  const isOffice =
    ext === 'xlsx' ||
    ext === 'xls' ||
    ext === 'docx' ||
    ext === 'doc' ||
    ext === 'pptx' ||
    ext === 'ppt'

  return (
    <aside
      className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-l-2xl border-l border-gray-100 bg-white shadow-2xl shadow-black/10"
      aria-labelledby="doc-preview-title"
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 bg-gray-50/90 px-5 py-4 backdrop-blur-sm">
        <div className="min-w-0 space-y-1">
          <p id="doc-preview-title" className="truncate text-sm font-semibold text-gray-900">
            文档预览
          </p>
          <p className="truncate text-xs text-gray-500">{fullName}</p>
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

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-5 pb-5 pt-4">
        <div className="shrink-0 space-y-4 overflow-y-auto pr-0.5">
          {/* 1. Basic info */}
          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              基本信息
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">文件名</dt>
                <dd className="max-w-[60%] truncate text-right font-medium text-gray-900">
                  {fullName}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">所属科室</dt>
                <dd className="max-w-[60%] truncate text-right font-medium text-gray-900">
                  {doc.dept}
                </dd>
              </div>
              {fileUrl ? (
                <div className="flex justify-between gap-3 pt-1">
                  <dt className="text-gray-500">文件地址</dt>
                  <dd className="max-w-[70%] break-all text-right font-mono text-[10px] text-gray-500">
                    {fileUrl}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          {/* 2. Agent extraction */}
          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Agent 提取状态
              </h3>
              <span className="text-[10px] text-gray-400">Qwen · MinerU</span>
            </div>
            <ul className="space-y-3">
              {doc.extracted.map((row) => (
                <li
                  key={row.label}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5"
                >
                  <span className="text-xs text-gray-500">{row.label}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{row.value}</span>
                    {row.ok !== false ? (
                      <UploadedBadge>提取成功</UploadedBadge>
                    ) : (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        待复核
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* 3. Live preview — flex-1 fills slide panel */}
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-white/95 px-4 py-3.5 backdrop-blur-sm">
            <FileText className="size-[18px] shrink-0 text-blue-600" strokeWidth={2} />
            <span className="text-xs font-semibold tracking-tight text-slate-700">原文档预览</span>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden bg-slate-50/90">
            {!fileUrl ? (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 px-6 text-center">
                <FileType2 className="size-12 text-slate-300" strokeWidth={1.25} />
                <p className="text-sm font-medium text-slate-600">未配置可访问的文件路径</p>
                <p className="max-w-xs text-xs leading-relaxed text-slate-500">
                  请在快照中为清单项设置 preview_relative_path，或传入 origin_type · doc_category · file_name。
                </p>
              </div>
            ) : isPdf ? (
              <iframe
                title={`PDF 预览：${fullName}`}
                src={fileUrl}
                className="box-border h-full min-h-[500px] w-full flex-1 rounded-lg border border-gray-200 bg-white shadow-inner"
              />
            ) : isOffice ? (
              <OfficeAiSummaryPreview doc={doc} fileUrl={fileUrl} ext={ext} />
            ) : (
              <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4 px-6">
                <FileType2 className="size-14 text-slate-400" />
                <p className="text-center text-sm text-slate-600">
                  暂不支持此格式的内嵌预览（.{ext || '?'}）
                </p>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-blue-600 shadow-sm hover:bg-blue-50"
                >
                  <span aria-hidden>📥</span>
                  打开或下载文件
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            )}
          </div>
        </section>
      </div>
    </aside>
  )
}
