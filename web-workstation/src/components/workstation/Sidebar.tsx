import {
  Activity,
  BarChart3,
  FolderOpen,
  LayoutDashboard,
  Settings,
  Shuffle,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { pickString, type MockSnapshot, type NavItem } from '@/data/mockSnapshot'

const iconMap = {
  layout: LayoutDashboard,
  shuffle: Shuffle,
  activity: Activity,
  bar: BarChart3,
  folder: FolderOpen,
  settings: Settings,
}

export interface SidebarProps {
  snapshot: MockSnapshot
  activeId: string
  onSelect: (id: string) => void
}

export function Sidebar({ snapshot, activeId, onSelect }: SidebarProps) {
  const s = snapshot.strings
  return (
    <aside className="flex w-56 shrink-0 flex-col gap-6 border-r border-slate-800/90 bg-[#0c1322] px-3 py-6">
      <div className="px-2">
        <p className="text-[10px] font-medium uppercase tracking-widest text-emerald-400/90">
          {s.workstation.sidebar_brand_accent}
        </p>
        <p className="mt-1 text-sm font-semibold leading-tight text-slate-50">
          {pickString(s, 'product_title')}
        </p>
      </div>
      <nav className="flex flex-col gap-0.5">
        {snapshot.nav_items.map((item: NavItem) => {
          const Icon = iconMap[item.icon] ?? LayoutDashboard
          const selected = item.id === activeId
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                selected
                  ? 'bg-blue-600/20 text-blue-100 shadow-inner ring-1 ring-blue-500/40'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
              )}
            >
              <Icon className="size-4 shrink-0 opacity-90" strokeWidth={2} />
              <span className="truncate">
                {pickString(s, item.label_key)}
              </span>
              {selected ? (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />
              ) : null}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
