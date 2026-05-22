import { useState, useRef, useEffect } from 'react'
import { Bell, ChevronDown, LogOut } from 'lucide-react'

/**
 * Top application header — logo, primary nav, notifications, user menu.
 * Props:
 *   navTabs   — [{ key, label }]
 *   activeTab — string
 *   onTabChange(key) — callback
 *   user      — { name, role, notificationCount }
 *   onLogout  — callback (optional)
 *   demoScenario — 'default' | 'happy' (optional)
 *   onDemoScenarioChange — (value) => void (optional)
 *   demoScenarioOptions — [{ value, label }] (optional)
 */
export default function Header({
  navTabs,
  activeTab,
  onTabChange,
  user,
  onLogout,
  demoScenario,
  onDemoScenarioChange,
  demoScenarioOptions,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-8 border-b border-slate-100 bg-white/95 px-8 backdrop-blur">
      {/* Logo / product name */}
      <div className="flex items-center gap-2.5">
        <div className="relative flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-sm shadow-blue-500/30">
          <span className="absolute inset-1 rounded-lg border border-white/30" />
          <span className="text-[13px] font-bold text-white">A</span>
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight text-slate-900">
            ARIA <span className="text-blue-600">工作台</span>
          </div>
          <div className="text-[11px] text-slate-400">医疗设备立项数据智能体</div>
        </div>
      </div>

      {/* Primary nav */}
      <nav className="flex flex-1 items-center justify-center gap-1">
        {navTabs.map((tab) => {
          const isActive = tab.key === activeTab
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange?.(tab.key)}
              className={[
                'relative rounded-lg px-4 py-1.5 text-sm transition-all',
                isActive
                  ? 'text-blue-600 font-semibold bg-blue-50'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50',
              ].join(' ')}
            >
              {tab.label}
              {isActive && (
                <span className="absolute -bottom-[18px] left-1/2 h-[3px] w-5 -translate-x-1/2 rounded-full bg-blue-600" />
              )}
            </button>
          )
        })}
      </nav>


      {/* Right cluster */}
      <div className="flex items-center gap-5">
        {/* Notification bell */}
        <button
          type="button"
          className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
          aria-label="通知"
        >
          <Bell className="size-5" strokeWidth={1.75} />
          {user.notificationCount > 0 && (
            <span className="absolute right-1 top-1 flex size-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
              {user.notificationCount}
            </span>
          )}
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-xl px-2 py-1 transition-colors hover:bg-slate-50"
          >
            <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-pink-300 to-orange-300 text-sm font-semibold text-white ring-2 ring-white">
              {user.name.slice(0, 1)}
            </div>
            <div className="leading-tight text-left">
              <div className="text-[13px] font-medium text-slate-800">{user.name}</div>
              <div className="text-[11px] text-slate-400">{user.role}</div>
            </div>
            <ChevronDown
              className={`size-3.5 text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
              strokeWidth={2}
            />
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-44 rounded-xl border border-slate-100 bg-white py-1.5 shadow-lg shadow-slate-200/60">
              <div className="border-b border-slate-50 px-4 py-2.5">
                <div className="text-[13px] font-medium text-slate-800">{user.name}</div>
                <div className="text-[11px] text-slate-400">{user.role}</div>
              </div>
              {onLogout && (
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onLogout() }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut className="size-4" strokeWidth={1.75} />
                  退出登录
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
