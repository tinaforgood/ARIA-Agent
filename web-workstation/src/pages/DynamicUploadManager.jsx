import { useState, useRef, useCallback } from "react";

// ─── Mock Data ───────────────────────────────────────────────────────────────
const mockTemplateCategories = [
  { id: "c1", name: "医院基本情况表",         required: true,  uploadedFiles: [] },
  { id: "c2", name: "拟申请设备预算项目清单",  required: true,  uploadedFiles: [] },
  { id: "c3", name: "预算论证会议纪要",        required: true,  uploadedFiles: [] },
  { id: "c4", name: "医疗器械NMPA证",          required: false, uploadedFiles: [] },
  { id: "c5", name: "市级绩效申报表",          required: true,  uploadedFiles: [] },
];

// Mock AI 拆分结果（延时后展示）
const mockSplitResult = [
  { id: "s1", pages: "第 1–2 页",   title: "医院概况与科室配置",   suggestedCategoryId: "c1" },
  { id: "s2", pages: "第 3–5 页",   title: "11 台设备预算清单",    suggestedCategoryId: "c2" },
  { id: "s3", pages: "第 6–7 页",   title: "2025 年预算论证纪要",  suggestedCategoryId: "c3" },
  { id: "s4", pages: "第 8 页",     title: "NMPA 注册证汇总",      suggestedCategoryId: "c4" },
  { id: "s5", pages: "第 9–10 页",  title: "市级绩效指标申报表",   suggestedCategoryId: "c5" },
];

// ─── Icons (inline SVG helpers) ───────────────────────────────────────────────
const IconSparkle = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
       className="w-6 h-6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
  </svg>
);

const IconUpload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
       className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16"/>
    <line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
  </svg>
);

const IconFile = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
       className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
       className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const IconChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       className="w-3.5 h-3.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

// ─── Skeleton Loader ──────────────────────────────────────────────────────────
const SkeletonRow = () => (
  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 animate-pulse">
    <div className="w-8 h-8 rounded bg-slate-200 flex-shrink-0"/>
    <div className="flex-1 space-y-1.5">
      <div className="h-3 bg-slate-200 rounded w-3/5"/>
      <div className="h-2.5 bg-slate-200 rounded w-2/5"/>
    </div>
    <div className="w-32 h-7 bg-slate-200 rounded-md"/>
  </div>
);

// ─── Split Review Modal ───────────────────────────────────────────────────────
function SplitReviewModal({ file, categories, onConfirm, onCancel }) {
  const [isLoading, setIsLoading] = useState(true);
  const [splitItems, setSplitItems] = useState([]);
  const [mappings, setMappings] = useState({});

  // Simulate AI analysis delay
  useState(() => {
    const timer = setTimeout(() => {
      const initial = {};
      mockSplitResult.forEach(item => { initial[item.id] = item.suggestedCategoryId; });
      setSplitItems(mockSplitResult);
      setMappings(initial);
      setIsLoading(false);
    }, 1800);
    return () => clearTimeout(timer);
  });

  const handleMappingChange = (splitId, catId) => {
    setMappings(prev => ({ ...prev, [splitId]: catId }));
  };

  const handleConfirm = () => {
    const result = splitItems.map(item => ({
      ...item,
      assignedCategoryId: mappings[item.id],
    }));
    onConfirm(result);
  };

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal Panel */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-100 flex flex-col overflow-hidden"
           style={{ maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white">
              <IconSparkle />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">AI 智能拆分预览</h2>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">
                {file?.name ?? "预算评审资料目录.pdf"}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <IconX />
          </button>
        </div>

        {/* Column Labels */}
        <div className="flex items-center gap-3 px-6 py-2.5 bg-slate-50 border-b border-slate-100">
          <div className="flex-1 text-xs font-medium text-slate-400 uppercase tracking-wider">
            拆分子文件
          </div>
          <div className="w-44 text-xs font-medium text-slate-400 uppercase tracking-wider">
            归档至分类
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
          {isLoading ? (
            <>
              {/* Skeleton rows */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }}/>
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }}/>
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }}/>
                </div>
                <span className="text-xs text-slate-400">MriAgent 正在分析文档结构，识别章节边界…</span>
              </div>
              {[1, 2, 3, 4].map(i => <SkeletonRow key={i} />)}
            </>
          ) : (
            splitItems.map((item, idx) => (
              <div key={item.id}
                   className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:border-blue-100 hover:bg-blue-50/30 transition-colors group">
                {/* Index badge */}
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 group-hover:bg-blue-100 text-slate-500 group-hover:text-blue-600 text-xs font-semibold flex items-center justify-center transition-colors">
                  {idx + 1}
                </span>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{item.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.pages}</p>
                </div>

                {/* Arrow */}
                <span className="text-slate-300 flex-shrink-0">
                  <IconChevronRight />
                </span>

                {/* Category Select */}
                <select
                  value={mappings[item.id] ?? ""}
                  onChange={e => handleMappingChange(item.id, e.target.value)}
                  className="w-44 flex-shrink-0 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer hover:border-blue-300 transition-colors"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
          <p className="text-xs text-slate-400">
            {isLoading
              ? "分析中…"
              : `已识别 ${splitItems.length} 个子文件 · 可手动修正映射后归档`}
          </p>
          <div className="flex gap-2.5">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm shadow-blue-200"
            >
              <IconCheck />
              确认归档入库
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Category Card ────────────────────────────────────────────────────────────
function CategoryCard({ category, onManualUpload }) {
  const hasFiles = category.uploadedFiles.length > 0;

  return (
    <div className={`group flex items-center gap-4 px-5 py-4 rounded-xl border transition-all duration-200
      ${hasFiles
        ? "border-blue-100 bg-blue-50/40 hover:border-blue-200"
        : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm hover:shadow-slate-100"
      }`}
    >
      {/* Status dot */}
      <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-0.5 transition-colors
        ${hasFiles ? "bg-blue-500" : category.required ? "bg-amber-400" : "bg-slate-200"}`}
      />

      {/* Name & badge */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-700 truncate">{category.name}</span>
          {category.required && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-100">
              必填
            </span>
          )}
        </div>

        {/* Uploaded files */}
        {hasFiles && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {category.uploadedFiles.map((f, i) => (
              <span key={i}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-blue-100 text-xs text-blue-700">
                <IconFile />
                {f.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Manual Upload Button */}
      <label className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-500
                        hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer">
        <IconUpload />
        <span>上传</span>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png"
          className="hidden"
          onChange={e => {
            if (e.target.files?.[0]) onManualUpload(category.id, e.target.files[0]);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

// ─── AI Dropzone ──────────────────────────────────────────────────────────────
function AIDropzone({ onFileDrop }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileDrop(file);
  }, [onFileDrop]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onFileDrop(file);
    e.target.value = "";
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 p-8 overflow-hidden
        ${isDragging
          ? "border-blue-500 bg-blue-50 scale-[1.01]"
          : "border-blue-200 bg-gradient-to-br from-blue-50/60 to-slate-50 hover:border-blue-400 hover:bg-blue-50/80"
        }`}
    >
      {/* Glowing ring when dragging */}
      {isDragging && (
        <div className="absolute inset-0 rounded-2xl ring-4 ring-blue-400/30 ring-offset-2 animate-pulse pointer-events-none"/>
      )}

      {/* Background grid decoration */}
      <div className="absolute inset-0 opacity-[0.03]"
           style={{ backgroundImage: "radial-gradient(circle, #3b82f6 1px, transparent 1px)", backgroundSize: "24px 24px" }}
      />

      <div className="relative flex flex-col items-center text-center gap-4">
        {/* Icon cluster */}
        <div className="relative">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300
            ${isDragging ? "bg-blue-600 shadow-blue-300 scale-110" : "bg-blue-600 shadow-blue-200"}`}>
            <span className="text-white">
              <IconSparkle />
            </span>
          </div>
          {/* Pulse rings */}
          <span className="absolute inset-0 rounded-2xl bg-blue-400/20 animate-ping"/>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-700 leading-snug">
            拖拽或点击上传完整的《预算评审资料目录》长卷 PDF
          </p>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed max-w-sm">
            MriAgent 将自动为您拆分并归类，支持多章节智能识别
          </p>
        </div>

        <div className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-medium transition-all duration-200
          ${isDragging
            ? "bg-blue-600 text-white shadow-md shadow-blue-200"
            : "bg-white text-blue-600 border border-blue-200 shadow-sm hover:shadow-blue-100"
          }`}>
          <IconUpload />
          {isDragging ? "松开以开始分析…" : "选择 PDF 文件"}
        </div>

        <p className="text-[11px] text-slate-300">仅支持 .pdf · 建议 50MB 以内</p>
      </div>

      <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
    </div>
  );
}

// ─── Toast Notification ───────────────────────────────────────────────────────
function Toast({ message, onDone }) {
  useState(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  });
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-800 text-white text-sm shadow-xl animate-fade-in-up">
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 flex-shrink-0">
        <IconCheck />
      </span>
      {message}
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ categories }) {
  const required = categories.filter(c => c.required);
  const done     = required.filter(c => c.uploadedFiles.length > 0).length;
  const pct      = required.length ? Math.round((done / required.length) * 100) : 0;

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-400 whitespace-nowrap font-medium">
        必填已上传 {done}/{required.length}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DynamicUploadManager() {
  const [categories, setCategories] = useState(mockTemplateCategories);
  const [pendingFile, setPendingFile]   = useState(null);   // file waiting for modal
  const [showModal, setShowModal]       = useState(false);
  const [toast, setToast]               = useState(null);

  // AI Dropzone handler
  const handleAIDrop = (file) => {
    setPendingFile(file);
    setShowModal(true);
  };

  // Confirm from modal → distribute files into categories
  const handleConfirmSplit = (splitItems) => {
    setCategories(prev =>
      prev.map(cat => {
        const assigned = splitItems.filter(s => s.assignedCategoryId === cat.id);
        if (assigned.length === 0) return cat;
        return {
          ...cat,
          uploadedFiles: [
            ...cat.uploadedFiles,
            ...assigned.map(s => ({ name: s.title, pages: s.pages, source: "ai" })),
          ],
        };
      })
    );
    setShowModal(false);
    setPendingFile(null);
    setToast(`已成功归档 ${splitItems.length} 个子文件`);
  };

  // Manual single-file upload
  const handleManualUpload = (catId, file) => {
    setCategories(prev =>
      prev.map(cat =>
        cat.id === catId
          ? { ...cat, uploadedFiles: [...cat.uploadedFiles, { name: file.name, source: "manual" }] }
          : cat
      )
    );
    setToast(`《${file.name}》已上传`);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Page header */}
        <div>
          <h1 className="text-lg font-semibold text-slate-800 tracking-tight">文档资料上传</h1>
          <p className="mt-0.5 text-sm text-slate-400">请按分类上传立项所需材料，带 <span className="text-amber-500 font-medium">*</span> 为必填项</p>
        </div>

        {/* ── Zone 1: AI Magic Upload ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-600 text-white text-[11px] font-semibold tracking-wide">
              <IconSparkle />
              AI 智能长文档解析
            </span>
            <span className="text-[11px] text-slate-400">一键上传 · 自动拆分归类</span>
          </div>
          <AIDropzone onFileDrop={handleAIDrop} />
        </section>

        {/* ── Zone 2: Manual Category List ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">标准目录清单</span>
              <span className="text-[11px] text-slate-300">·</span>
              <span className="text-[11px] text-slate-400">精准点射模式</span>
            </div>
          </div>

          {/* Progress */}
          <div className="mb-4">
            <ProgressBar categories={categories} />
          </div>

          {/* Cards */}
          <div className="space-y-2">
            {categories.map((cat, idx) => (
              <CategoryCard
                key={cat.id}
                category={cat}
                onManualUpload={handleManualUpload}
              />
            ))}
          </div>
        </section>

        {/* Submit */}
        <div className="flex justify-end pt-2 pb-8">
          <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm shadow-blue-200 transition-colors">
            提交全部材料
            <IconChevronRight />
          </button>
        </div>
      </div>

      {/* Split Review Modal */}
      {showModal && (
        <SplitReviewModal
          file={pendingFile}
          categories={categories}
          onConfirm={handleConfirmSplit}
          onCancel={() => { setShowModal(false); setPendingFile(null); }}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
