import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App       from './App.tsx'
import Dashboard from './pages/Dashboard'
import LoginPage from './pages/Login/LoginPage.jsx'

// ─── Auth wrapper ─────────────────────────────────────────────────────────────
// Persists session in sessionStorage so a page-refresh keeps the user logged in
// within the same browser tab (clears on tab close, as expected for a demo env).

const SESSION_KEY = 'mriagent_user'

function restoreSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function Root() {
  const [user, setUser] = useState(restoreSession)

  function handleLogin(u: unknown) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(u))
    setUser(u)
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY)
    setUser(null)
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />
  }

  // Route by URL hash (same logic as before)
  //   http://localhost:5173/          → Dashboard (default)
  //   http://localhost:5173/#material → legacy MaterialFlow app
  const showLegacy = window.location.hash.replace('#', '') === 'material'
  return showLegacy
    ? <App />
    : <Dashboard currentUser={user} onLogout={handleLogout} />
}

// ─── Mount ────────────────────────────────────────────────────────────────────
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

// Live-swap when the user manually edits the hash
window.addEventListener('hashchange', () => window.location.reload())
