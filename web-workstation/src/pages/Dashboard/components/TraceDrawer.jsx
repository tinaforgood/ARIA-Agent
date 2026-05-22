/**
 * TraceDrawer — 证据链溯源抽屉（右侧 Slide-over）
 *
 * 默认隐藏。当用户点击 DocDetailView 中带冲突标注的字段时，
 * 从右侧平滑滑入，宽度 w-[40%]，展示原始凭证比对与 BBox 溯源信息。
 *
 * Props:
 *   isOpen      — 是否展开
 *   field       — 触发的字段对象 { label, value, sources: [{type,value,file},...] }
 *   onClose     — 关闭回调
 */

import { X, FileSearch, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react'

// ── Mock PDF preview 占位块 ────────────────────────────────────────────────────
function PdfPreview({ title, value, tag, tagColor }) {
  return (
    <div className="flex flex-col gap-2">
      {/* Source label */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-slate-600">{title}</span>
        <span className={[
          'rounded-full px-2 py-0.5 text-[11px] font-semibold',
          tagColor === 'blue'   ? 'bg-blue-50 text-blue-600'  :
          tagColor === 'amber'  ? 'bg-amber-50 text-amber-700' :
          'bg-slate-100 text-slate-600',
        ].join(' ')}>
          {value}
        </span>
      </div>

      {/* PDF placeholder */}
      <div className="relative overflow-hidden rounded-xl bg-slate-200" style={{ height: 180 }}>
        {/* Simulated PDF page lines */}
        <div className="absolute inset-0 flex flex-col gap-2 p-4 opacity-40">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-2 rounded-full bg-slate-400"
              style={{ width: `${60 + Math.sin(i * 1.7) * 25}%` }}
            />
          ))}
        </div>
        {/* Highlight overlay — simulates BBox highlight */}
        <div className="absolute left-4 top-[68px] h-7 rounded bg-yellow-300/60 ring-1 ring-yellow-400"
          style={{ width: '55%' }} />
        {/* Tag */}
        <div className="absolute bottom-3 left-3">
          <span className="rounded-md bg-slate-700/80 px-2 py-1 text-[10px] font-medium text-white">
            {tag}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TraceDrawer({ isOpen, field, onClose }) {
  const hasConflict = field?.sources && field.sources.length > 1

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        className={[
          'fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-[1px] transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onClose}
      />

      {/* ── Drawer panel ── */}
      <div
        className={[
          'fixed right-0 top-0 z-40 flex h-full w-[42%] min-w-[440px] flex-col',
          'bg-white shadow-2xl border-l border-slate-200',
          'transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* ── Header ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50">
              <FileSearch className="size-4 text-blue-600" strokeWidth={1.75} />
            </span>
            <div>
              <h3 className="text-[14px] font-semibold text-slate-900">原始凭证比对</h3>
              <p className="text-[11.5px] text-slate-400">Evidence Traceability</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">

          {/* Field info */}
          {field && (
            <div className={[
              'flex items-start gap-3 rounded-xl p-3.5',
              hasConflict ? 'bg-amber-50 border border-amber-100' : 'bg-blue-50 border border-blue-100',
            ].join(' ')}>
              {hasConflict
                ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" strokeWidth={2} />
                : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-blue-500" strokeWidth={2} />
              }
              <div className="min-w-0">
                <p className={[
                  'text-[12.5px] font-semibold',
                  hasConflict ? 'text-amber-700' : 'text-blue-700',
                ].join(' ')}>
                  字段：{field.label}
                </p>
                <p className="mt-0.5 text-[12px] text-slate-600">
                  当前采信值：<span className="font-semibold text-slate-800">{field.value}</span>
                </p>
                {hasConflict && (
                  <p className="mt-1 text-[11.5px] text-amber-600">
                    ⚡ 检测到 {field.sources.length} 个来源存在数值差异，需人工裁决
                  </p>
                )}
              </div>
            </div>
          )}

          {/* PDF previews */}
          {field?.sources?.map((src, idx) => (
            <PdfPreview
              key={idx}
              title={`来源 ${idx + 1}：${src.type}`}
              value={src.value}
              tag={`第 ${src.page ?? 3} 页 · BBox 已高亮`}
              tagColor={idx === 0 ? 'blue' : 'amber'}
            />
          ))}

          {/* No conflict: single source */}
          {field && !field.sources && (
            <PdfPreview
              title={`来源：${field.sourceFile ?? '原始文档'}`}
              value={field.value}
              tag="第 5 页 · BBox 已高亮"
              tagColor="blue"
            />
          )}

          {/* Source file list */}
          {field?.sources && (
            <div className="rounded-xl border border-slate-100 bg-white p-3.5">
              <p className="mb-2.5 text-[12px] font-semibold text-slate-700">原始来源文件</p>
              <div className="flex flex-col gap-2">
                {field.sources.map((src, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className={[
                        'size-2 shrink-0 rounded-full',
                        idx === 0 ? 'bg-blue-500' : 'bg-amber-500',
                      ].join(' ')} />
                      <span className="truncate text-[12px] text-slate-600">{src.file ?? `${src.type} 来源文档`}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={[
                        'rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold',
                        idx === 0 ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-700',
                      ].join(' ')}>{src.value}</span>
                      <button type="button" className="text-slate-300 hover:text-blue-500 transition-colors">
                        <ExternalLink className="size-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decision action (only for conflicts) */}
          {hasConflict && (
            <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 p-4">
              <p className="mb-3 text-[12.5px] font-semibold text-amber-700">发起人工裁决</p>
              <p className="mb-3 text-[12px] text-slate-600">请选择最终采信的数值，系统将更新快照并重新触发相关节点测算：</p>
              <div className="flex gap-2">
                {field?.sources?.map((src, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={[
                      'flex-1 rounded-lg border py-2 text-[12px] font-medium transition-colors',
                      idx === 0
                        ? 'border-blue-200 bg-white text-blue-600 hover:bg-blue-50'
                        : 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50',
                    ].join(' ')}
                  >
                    采信 {src.value}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-slate-100 px-5 py-3">
          <p className="text-[11px] text-slate-400">
            证据链由 MinerU 解析时生成 · BBox 坐标已记录至 evidence_trace.json
          </p>
        </div>
      </div>
    </>
  )
}
