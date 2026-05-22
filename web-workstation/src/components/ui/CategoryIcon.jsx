/**
 * Small rounded icon chip for accordion category headers.
 * @param {{ tone?: 'blue' | 'orange' | 'purple' | 'sky'; children: import('react').ReactNode }} props
 */
export function CategoryIcon({ tone = 'blue', children }) {
  const map = {
    blue: 'bg-blue-600 shadow-blue-500/25',
    sky: 'bg-sky-500 shadow-sky-500/25',
    orange: 'bg-amber-500 shadow-amber-500/25',
    purple: 'bg-violet-600 shadow-violet-500/25',
  }
  return (
    <span
      className={`flex size-7 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white shadow-md ${map[tone] ?? map.blue}`}
    >
      {children}
    </span>
  )
}
