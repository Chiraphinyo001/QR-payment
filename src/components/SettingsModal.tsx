'use client'

import { useState, useEffect } from 'react'

// ── Types ────────────────────────────────────────────────────────
type Theme = 'light' | 'dark' | 'system'

const APP_VERSION  = '1.0.0'
const NEXT_VERSION = '14.2.0'
const SSR_VERSION  = '0.10.3'

// ── Helpers ──────────────────────────────────────────────────────
function maskKey(key: string | undefined): string {
  if (!key) return '—'
  if (key.length <= 12) return key
  return key.slice(0, 8) + '••••••••••••' + key.slice(-4)
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg
                 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600
                 text-gray-600 dark:text-gray-300 transition-colors"
      title={`คัดลอก${label ?? ''}`}
    >
      {copied ? (
        <>
          <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-green-600 dark:text-green-400">คัดลอกแล้ว</span>
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          คัดลอก
        </>
      )}
    </button>
  )
}

// ── Theme Toggle ─────────────────────────────────────────────────
function ThemeSelector({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  const options: { value: Theme; label: string; icon: string }[] = [
    { value: 'light',  label: 'สว่าง',  icon: '☀️' },
    { value: 'dark',   label: 'มืด',    icon: '🌙' },
    { value: 'system', label: 'ระบบ',   icon: '💻' },
  ]
  return (
    <div className="flex gap-1.5">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-xs font-medium
                      transition-all border-2 ${
            theme === o.value
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
              : 'border-transparent bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          <span className="text-base">{o.icon}</span>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Main Settings Modal ──────────────────────────────────────────
interface SettingsModalProps {
  onClose: () => void
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [theme, setTheme] = useState<Theme>('light')
  const [showKey, setShowKey] = useState(false)
  
  const [isThemeOpen, setIsThemeOpen] = useState(false)
  const [isApiOpen, setIsApiOpen] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

  // โหลด theme จาก localStorage
  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null
    if (saved) {
      setTheme(saved)
    } else {
      setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    }
  }, [])

  // Apply theme เมื่อเปลี่ยน
  const handleThemeChange = (t: Theme) => {
    setTheme(t)
    localStorage.setItem('theme', t)
    const root = document.documentElement
    if (t === 'dark') {
      root.classList.add('dark')
    } else if (t === 'light') {
      root.classList.remove('dark')
    } else {
      // system
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      prefersDark ? root.classList.add('dark') : root.classList.remove('dark')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
         onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md
                      border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col max-h-full"
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4
                        border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">การตั้งค่า</h2>
          </div>
          <button onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100
                       dark:hover:bg-gray-800 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable Accordions */}
        <div className="overflow-y-auto p-4 space-y-3">

          {/* ── ธีม ── */}
          <div className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden bg-white dark:bg-gray-900 transition-colors">
            <button 
              onClick={() => setIsThemeOpen(v => !v)}
              className="w-full flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-800/20 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <span>🎨</span> ธีม
              </h3>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${isThemeOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isThemeOpen && (
              <div className="p-4 pt-2 border-t border-gray-100 dark:border-gray-800 space-y-4 animate-fade-in">
                <p className="text-xs text-gray-500 dark:text-gray-400">เลือกธีมการแสดงผลของแอป</p>
                <ThemeSelector theme={theme} onChange={handleThemeChange} />
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/50 rounded-xl">
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    ธีมปัจจุบัน: <span className="font-semibold">
                      {theme === 'light' ? '☀️ สว่าง' : theme === 'dark' ? '🌙 มืด' : '💻 ตามระบบ'}
                    </span>
                    {' '}— บันทึกอัตโนมัติ
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── API ── */}
          <div className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden bg-white dark:bg-gray-900 transition-colors">
            <button 
              onClick={() => setIsApiOpen(v => !v)}
              className="w-full flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-800/20 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <span>🔑</span> ข้อมูล API
              </h3>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${isApiOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isApiOpen && (
              <div className="p-4 pt-2 border-t border-gray-100 dark:border-gray-800 space-y-3 animate-fade-in">
                <p className="text-xs text-gray-500 dark:text-gray-400">ข้อมูลการเชื่อมต่อสำหรับนักพัฒนา</p>

                {/* Supabase URL */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Supabase URL</label>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <code className="flex-1 text-xs text-gray-700 dark:text-gray-300 font-mono truncate">
                      {supabaseUrl || '—'}
                    </code>
                    {supabaseUrl && <CopyButton value={supabaseUrl} label="URL" />}
                  </div>
                </div>

                {/* Anon Key */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Anon Key (Public)</label>
                    <button
                      onClick={() => setShowKey(v => !v)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {showKey ? '🙈 ซ่อน' : '👁 แสดง'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <code className="flex-1 text-xs text-gray-700 dark:text-gray-300 font-mono truncate">
                      {showKey ? anonKey : maskKey(anonKey)}
                    </code>
                    {anonKey && <CopyButton value={anonKey} label="Key" />}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">🔒 ใช้ได้เฉพาะฝั่ง client (safe to expose)</p>
                </div>

                {/* API Endpoints */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">App API Endpoints</label>
                  <div className="space-y-1.5">
                    {[
                      { method: 'POST', path: '/api/generate', desc: 'สร้าง QR Code' },
                      { method: 'GET',  path: '/api/payments', desc: 'ดูประวัติ QR' },
                      { method: 'DELETE', path: '/api/payments?id=', desc: 'ลบ QR Code' },
                    ].map(ep => (
                      <div key={ep.path} className="flex items-center gap-2.5 p-2.5
                                                     bg-gray-50 dark:bg-gray-800 rounded-xl">
                        <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded-md ${
                          ep.method === 'POST'   ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400' :
                          ep.method === 'DELETE' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-400' :
                                                   'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-400'
                        }`}>{ep.method}</span>
                        <code className="flex-1 text-xs text-gray-700 dark:text-gray-300 font-mono">{ep.path}</code>
                        <span className="text-xs text-gray-400">{ep.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── เวอร์ชัน ── */}
          <div className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden bg-white dark:bg-gray-900 transition-colors">
            <button 
              onClick={() => setIsAboutOpen(v => !v)}
              className="w-full flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-800/20 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <span>ℹ️</span> เวอร์ชันแอปพลิเคชัน
              </h3>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${isAboutOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isAboutOpen && (
              <div className="p-4 pt-2 border-t border-gray-100 dark:border-gray-800 space-y-3 animate-fade-in">
                
                {/* App */}
                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50
                                dark:from-blue-950/50 dark:to-indigo-950/50
                                rounded-xl border border-blue-100 dark:border-blue-900">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">QR Pay</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">PromptPay Generator</p>
                    </div>
                    <span className="ml-auto text-xs font-mono bg-blue-100 dark:bg-blue-900
                                     text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-semibold">
                      v{APP_VERSION}
                    </span>
                  </div>
                </div>

                {/* Dependencies */}
                <div className="space-y-1.5 mt-4">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Dependencies</label>
                  {[
                    { name: 'Next.js',           version: NEXT_VERSION,  color: 'bg-black text-white dark:bg-white dark:text-black' },
                    { name: '@supabase/ssr',      version: SSR_VERSION,   color: 'bg-green-600 text-white' },
                    { name: 'React',             version: '18.3.0',      color: 'bg-cyan-500 text-white' },
                    { name: 'qrcode',            version: '1.5.3',       color: 'bg-purple-600 text-white' },
                    { name: 'Tailwind CSS',      version: '3.4.x',       color: 'bg-teal-500 text-white' },
                  ].map(dep => (
                    <div key={dep.name}
                         className="flex items-center justify-between px-3 py-2
                                    bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <span className="text-xs text-gray-700 dark:text-gray-300 font-mono">{dep.name}</span>
                      <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${dep.color}`}>
                        v{dep.version}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="text-center pt-3">
                  <p className="text-xs text-gray-400 dark:text-gray-600">
                    Built with ❤️ · {new Date().getFullYear()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
