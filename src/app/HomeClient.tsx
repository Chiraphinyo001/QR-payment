'use client'

import { useState, useRef, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import QrGenerator from '@/components/QrGenerator'
import PaymentHistory from '@/components/PaymentHistory'
import SettingsModal from '@/components/SettingsModal'
import ActiveQrPanel from '@/components/ActiveQrPanel'

interface HomeClientProps {
  userEmail: string | null
  avatarUrl: string | null
}

// ── Avatar helpers ──────────────────────────────────────────────
function getInitial(email: string | null): string {
  if (!email) return '?'
  return email.charAt(0).toUpperCase()
}

function getAvatarGradient(email: string | null): string {
  const gradients = [
    'from-blue-500 to-indigo-600',
    'from-violet-500 to-purple-600',
    'from-rose-500 to-pink-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-cyan-500 to-blue-600',
  ]
  if (!email) return gradients[0]
  const idx = email.charCodeAt(0) % gradients.length
  return gradients[idx]
}

// ── Avatar Component ────────────────────────────────────────────
function Avatar({
  email, avatarUrl, size = 'md'
}: { email: string | null; avatarUrl: string | null; size?: 'sm' | 'md' }) {
  const gradient = getAvatarGradient(email)
  const initial  = getInitial(email)
  const dim      = size === 'sm' ? 'w-9 h-9 text-sm' : 'w-9 h-9 text-sm'

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={email ?? 'profile'}
        referrerPolicy="no-referrer"
        className={`${dim} rounded-full object-cover`}
      />
    )
  }
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br ${gradient}
                     flex items-center justify-center text-white font-semibold`}>
      {initial}
    </div>
  )
}


// ── Main Component ───────────────────────────────────────────────
export default function HomeClient({ userEmail, avatarUrl }: HomeClientProps) {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [refreshKey, setRefreshKey] = useState(0)
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate')
  const [loggingOut, setLoggingOut] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const activePanelRef = useRef<HTMLDivElement>(null)

  // Apply saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const root = document.documentElement
    if (saved === 'dark') root.classList.add('dark')
    else if (saved === 'light') root.classList.remove('dark')
    else {
      // system
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) root.classList.add('dark')
    }
  }, [])

  // ปิด dropdown เมื่อ click ข้างนอก
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    setDropdownOpen(false)
    await supabase.auth.signOut()
    router.push('/auth')
    router.refresh()
  }

  return (
    <main className="min-h-screen">

      {/* Settings Modal */}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10 transition-colors">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm shadow-blue-200">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">QR Pay</h1>
              <p className="text-xs text-gray-400 leading-tight">PromptPay Generator</p>
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center gap-2">

            {/* Mobile tab switcher */}
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 gap-0.5 lg:hidden">
              {(['generate', 'history'] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    activeTab === t 
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}>
                  {t === 'generate' ? 'สร้าง QR' : 'ประวัติ'}
                </button>
              ))}
            </div>

            {/* Avatar + Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                id="btn-avatar"
                onClick={() => setDropdownOpen(v => !v)}
                className="w-9 h-9 rounded-full overflow-hidden
                           shadow-sm ring-2 ring-white hover:ring-gray-200 transition-all
                           focus:outline-none focus:ring-blue-300"
                title={userEmail ?? ''}
              >
                <Avatar email={userEmail} avatarUrl={avatarUrl} />
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-900 rounded-2xl shadow-lg
                                border border-gray-100 dark:border-gray-800 overflow-hidden z-50
                                animate-fade-in">

                  {/* User info */}
                  <div className="px-4 py-3 border-b border-gray-50 dark:border-gray-800">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-gray-100">
                        <Avatar email={userEmail} avatarUrl={avatarUrl} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                          {userEmail?.split('@')[0]}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{userEmail}</p>
                      </div>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="p-1.5">
                    <button
                      onClick={() => { setSettingsOpen(true); setDropdownOpen(false) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-300
                                 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors text-left"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      ตั้งค่า
                    </button>

                    <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

                    <button
                      id="btn-logout"
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 dark:text-red-400
                                 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors text-left disabled:opacity-50"
                    >
                      {loggingOut ? (
                        <span className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      )}
                      ออกจากระบบ
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Desktop: two-column layout */}
        <div className="hidden lg:grid lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_300px] gap-6 items-start">

          {/* Left: QR Generator + History */}
          <div className="space-y-6 min-w-0">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 transition-colors">
              <QrGenerator onGenerated={() => setRefreshKey(k => k + 1)} />
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 transition-colors">
              <PaymentHistory refreshKey={refreshKey} />
            </div>
          </div>

          {/* Right: Active QR Panel (sticky) */}
          <div className="sticky top-[72px] self-start" ref={activePanelRef}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 transition-all duration-300 max-h-[calc(100vh-96px)] overflow-hidden flex flex-col">
              <ActiveQrPanel refreshKey={refreshKey} />
            </div>
          </div>
        </div>

        {/* Mobile */}
        <div className="lg:hidden space-y-6">
          {activeTab === 'generate' ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 transition-colors">
              <QrGenerator onGenerated={() => { setRefreshKey(k => k + 1); setActiveTab('history') }} />
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 transition-colors">
              <PaymentHistory refreshKey={refreshKey} />
            </div>
          )}
          {/* Mobile: Active panel below */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 transition-colors">
            <ActiveQrPanel refreshKey={refreshKey} />
          </div>
        </div>
      </div>
    </main>
  )
}
