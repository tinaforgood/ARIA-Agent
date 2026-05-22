/**
 * LoginPage — MriAgent 登录入口
 *
 * Mock 账号（可直接点击快速登录）：
 *   张若昕  设备科·张老师      zhang / 123456
 *   李明辉  院办审批·李主任    li    / 123456
 *   王芳    放射科·王医生      wang  / 123456
 *   admin   系统管理员         admin / admin888
 *
 * Props:
 *   onLogin(user) — 登录成功后回调，传入当前用户对象
 */

import { useState } from 'react'
import { Eye, EyeOff, LogIn, ShieldCheck, Loader2 } from 'lucide-react'

// ─── Mock 用户库 ─────────────────────────────────────────────────────────────
const MOCK_USERS = [
  {
    id: 'zhang',
    username: 'zhang',
    password: '123456',
    name: '张若昕',
    role: '设备科·张老师',
    dept: '设备科',
    avatar: '张',
    avatarBg: 'from-blue-400 to-violet-500',
    notificationCount: 3,
  },
  {
    id: 'li',
    username: 'li',
    password: '123456',
    name: '李明辉',
    role: '院办审批·李主任',
    dept: '院办',
    avatar: '李',
    avatarBg: 'from-emerald-400 to-teal-500',
    notificationCount: 1,
  },
  {
    id: 'wang',
    username: 'wang',
    password: '123456',
    name: '王芳',
    role: '放射科·王医生',
    dept: '放射科',
    avatar: '王',
    avatarBg: 'from-orange-400 to-rose-500',
    notificationCount: 0,
  },
  {
    id: 'admin',
    username: 'admin',
    password: 'admin888',
    name: '系统管理员',
    role: '系统管理员',
    dept: '信息中心',
    avatar: '管',
    avatarBg: 'from-slate-500 to-slate-700',
    notificationCount: 0,
  },
]

export { MOCK_USERS }

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LoginPage({ onLogin }) {
  const [username, setUsername]   = useState('')
  const [password, setPassword]   = useState('')
  const [showPwd,  setShowPwd]    = useState(false)
  const [error,    setError]      = useState('')
  const [loading,  setLoading]    = useState(false)

  function doLogin(u, p) {
    setLoading(true)
    setError('')
    // Simulate async check
    setTimeout(() => {
      const user = MOCK_USERS.find(
        (m) => m.username === u.trim() && m.password === p,
      )
      if (user) {
        onLogin(user)
      } else {
        setError('用户名或密码错误，请重试')
        setLoading(false)
      }
    }, 600)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!username) { setError('请输入用户名'); return }
    if (!password) { setError('请输入密码');   return }
    doLogin(username, password)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 px-4">

      {/* Decorative blobs */}
      <div className="pointer-events-none fixed -left-32 -top-32 size-[500px] rounded-full bg-blue-100/50 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-32 -right-32 size-[500px] rounded-full bg-violet-100/40 blur-3xl" />

      <div className="relative w-full max-w-[420px]">

        {/* Card */}
        <div className="rounded-3xl border border-slate-100 bg-white/90 p-8 shadow-xl shadow-slate-200/60 backdrop-blur-sm">

          {/* Logo */}
          <div className="mb-6 flex flex-col items-center gap-3">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30">
              <ShieldCheck className="size-7 text-white" strokeWidth={1.75} />
            </div>
            <div className="text-center">
              <h1 className="text-[22px] font-bold tracking-tight text-slate-900">ARIA 工作台</h1>
              <p className="mt-0.5 text-[13px] text-slate-400">医疗设备立项数据智能体</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="mb-1.5 block text-[12.5px] font-medium text-slate-600">
                用户名
              </label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError('') }}
                placeholder="请输入用户名"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-[13.5px] text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-3 focus:ring-blue-100"
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-[12.5px] font-medium text-slate-600">
                密码
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  placeholder="请输入密码"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-11 text-[13.5px] text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-3 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPwd
                    ? <EyeOff className="size-4" strokeWidth={1.75} />
                    : <Eye    className="size-4" strokeWidth={1.75} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-2.5 text-[12.5px] font-medium text-red-600">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-500 text-[14px] font-semibold text-white shadow-sm shadow-blue-500/30 transition-all hover:bg-blue-600 active:scale-[0.98] disabled:opacity-60"
            >
              {loading
                ? <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                : <LogIn   className="size-4" strokeWidth={2} />}
              {loading ? '登录中…' : '登 录'}
            </button>
          </form>

        </div>

        {/* Footer hint */}
        <p className="mt-5 text-center text-[11.5px] text-slate-400">
          演示环境 · 数据均为 Mock · 仅供开发预览
        </p>
      </div>
    </div>
  )
}
