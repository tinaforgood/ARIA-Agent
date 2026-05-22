/** Green “已上传” pill — Material Flow checklist */
export function UploadedBadge({ children = '已上传', className = '' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 shadow-sm ${className}`}
    >
      {children}
    </span>
  )
}
