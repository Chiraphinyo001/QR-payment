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

function getInitial(email: string | null): string {
  if (!email) return '?'
  return email.charAt(0).toUpperCase()
}

function getAvatarColor(email: string | null): string {
  const colors = [
    'from-violet-500 to-indigo-600',
    'from-fuchsia-500 to-violet-600',
    'from-rose-500 to-pink-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-cyan-500 to-blue-600',
  ]
  if (!email) return colors[0]
  return colors[email.charCodeAt(0) % colors.length]
}

function Avatar({ email, avatarUrl, size = 'md' }: { email: string | null; avatarUrl: string | null; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm'
  if (avatarUrl) {
    return <img src={avatarUrl} alt={email ?? 'avatar'} referrerPolicy="no-referrer" className={`${dim} rounded-full object-cover ring-2 ring-white dark:ring-gray-800`} />
  }
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br ${getAvatarColor(email)} flex items-center justify-center text-white font-bold shadow-inner`}>
      {getInitial(email)}
    </div>
  )
}

// Tab icons
const TabIcon = ({ tab }: { tab: string }) => {
  if (tab === 'generate') return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
    </svg>
  )
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}

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

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const root = document.documentElement
    if (saved === 'dark') root.classList.add('dark')
    else if (saved === 'light') root.classList.remove('dark')
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) root.classList.add('dark')
  }, [])

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
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
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      {/* ── Header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-gray-200/60 dark:border-white/[0.06] bg-white/80 dark:bg-[#0d1117]/80 backdrop-blur-xl transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="relative w-9 h-9 flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg shadow-indigo-500/30" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold gradient-text leading-tight">QR Pay</h1>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight font-medium tracking-wide">PromptPay System</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile tabs */}
            <div className="flex bg-gray-100 dark:bg-white/5 rounded-xl p-0.5 gap-0.5 lg:hidden border border-gray-200/50 dark:border-white/5">
              {(['generate', 'history'] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === t
                      ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}>
                  <TabIcon tab={t} />
                  {t === 'generate' ? 'สร้าง QR' : 'ประวัติ'}
                </button>
              ))}
            </div>

            {/* Avatar dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                id="btn-avatar"
                onClick={() => setDropdownOpen(v => !v)}
                className="relative w-9 h-9 rounded-full overflow-hidden ring-2 ring-transparent hover:ring-indigo-400/50 dark:hover:ring-indigo-500/40 transition-all focus:outline-none focus:ring-indigo-400/60"
                title={userEmail ?? ''}
              >
                <Avatar email={userEmail} avatarUrl={avatarUrl} />
              </button>

              {dropdownOpen && (
                <>
                  {/* Backdrop to close */}
                  <div className="fixed inset-0 z-[99]" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute right-0 top-full mt-2.5 w-64 rounded-2xl overflow-hidden z-[100] animate-scale-in
                                  bg-white dark:bg-[#161b27] border border-gray-200 dark:border-[#2a3142]
                                  shadow-2xl shadow-black/20 dark:shadow-black/60">
                    {/* User info */}
                    <div className="px-4 py-3.5 border-b border-gray-100 dark:border-[#2a3142]">
                      <div className="flex items-center gap-3">
                        <Avatar email={userEmail} avatarUrl={avatarUrl} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {userEmail?.split('@')[0]}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{userEmail}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-1.5 space-y-0.5">
                      <button
                        onClick={() => { setSettingsOpen(true); setDropdownOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium
                                   text-gray-700 dark:text-gray-200
                                   hover:bg-gray-50 dark:hover:bg-white/5
                                   rounded-xl transition-colors text-left group"
                      >
                        <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                          <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        ตั้งค่า
                      </button>

                      <div className="my-1 mx-2 border-t border-gray-100 dark:border-[#2a3142]" />

                      <button
                        id="btn-logout"
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium
                                   text-rose-600 dark:text-rose-400
                                   hover:bg-rose-50 dark:hover:bg-rose-500/10
                                   rounded-xl transition-colors text-left disabled:opacity-50"
                      >
                        <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                          {loggingOut ? (
                            <span className="w-3.5 h-3.5 border-2 border-rose-300 border-t-rose-600 rounded-full animate-spin" />
                          ) : (
                            <svg className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                          )}
                        </div>
                        ออกจากระบบ
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* Desktop layout */}
        <div className="hidden lg:grid lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            <div className="rounded-2xl border border-gray-200 dark:border-[#1e2636] bg-white dark:bg-[#131825] shadow-sm p-6">
              <QrGenerator onGenerated={() => setRefreshKey(k => k + 1)} />
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-[#1e2636] bg-white dark:bg-[#131825] shadow-sm p-6">
              <PaymentHistory refreshKey={refreshKey} />
            </div>
          </div>

          {/* Right sticky */}
          <div className="sticky top-[72px] self-start">
            <div className="rounded-2xl border border-gray-200 dark:border-[#1e2636] bg-white dark:bg-[#131825] shadow-sm p-4 max-h-[calc(100vh-96px)] overflow-hidden flex flex-col">
              <ActiveQrPanel refreshKey={refreshKey} />
            </div>
          </div>
        </div>

        {/* Mobile layout */}
        <div className="lg:hidden space-y-4">
          {activeTab === 'generate' ? (
            <div className="rounded-2xl border border-gray-200 dark:border-[#1e2636] bg-white dark:bg-[#131825] shadow-sm p-5 animate-slide-up">
              <QrGenerator onGenerated={() => { setRefreshKey(k => k + 1); setActiveTab('history') }} />
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 dark:border-[#1e2636] bg-white dark:bg-[#131825] shadow-sm p-5 animate-slide-up">
              <PaymentHistory refreshKey={refreshKey} />
            </div>
          )}
          <div className="rounded-2xl border border-gray-200 dark:border-[#1e2636] bg-white dark:bg-[#131825] shadow-sm p-4">
            <ActiveQrPanel refreshKey={refreshKey} />
          </div>
        </div>
      </div>
    </main>
  )
}
