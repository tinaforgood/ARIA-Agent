/**
 * Neutral chrome for lucide icons — toolbar / dense lists.
 * @param {{ children: import('react').ReactNode; className?: string }} props
 */
export function IconFrame({ children, className = '' }) {
  return (
    <span
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-100 ${className}`}
    >
      {children}
    </span>
  )
}
