'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useSearchParams } from 'next/navigation'

type Tab = 'login' | 'register'

// ── Password strength helper ──────────────────────────────────────
function getStrength(pw: string): { score: number; label: string; color: string } {
  if (pw.length === 0) return { score: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const map = [
    { label: 'อ่อนมาก', color: 'bg-red-400' },
    { label: 'อ่อน',    color: 'bg-orange-400' },
    { label: 'ปานกลาง', color: 'bg-yellow-400' },
    { label: 'แข็งแรง', color: 'bg-green-400' },
    { label: 'แข็งแรงมาก', color: 'bg-green-600' },
  ]
  return { score, ...map[score] }
}

// ── EyeIcon ───────────────────────────────────────────────────────
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  )
}

// ── Main Component ────────────────────────────────────────────────
function AuthForm() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const searchParams = useSearchParams()

  const [tab, setTab]               = useState<Tab>('login')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [showCf, setShowCf]         = useState(false)
  const [agreed, setAgreed]         = useState(false)
  const [loading, setLoading]       = useState(false)
  const [socialLoading, setSocial]  = useState<'google' | 'line' | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [successMsg, setSuccess]    = useState<string | null>(null)

  // อ่าน error จาก URL
  useEffect(() => {
    const urlError = searchParams.get('error')
    if (urlError) {
      if (urlError === 'auth_callback_error') {
        setError('การเข้าสู่ระบบด้วย Social login ล้มเหลว เนื่องจากไม่ได้ตั้งค่า Provider ใน Supabase หรือมีการยกเลิก')
      } else {
        setError(urlError)
      }
    }
    
    // ตรวจสอบ error จาก URL Hash (Supabase มักจะส่ง error กลับมาทาง hash ถ้า provider ยังไม่เปิดใช้งาน)
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const hashError = hashParams.get('error_description') || hashParams.get('error')
      if (hashError) {
        const decodedError = decodeURIComponent(hashError.replace(/\+/g, ' '))
        setError(`การตั้งค่า Social Login ยังไม่สมบูรณ์: ${decodedError}`)
      }
    }
  }, [searchParams])

  const reset = () => { setError(null); setSuccess(null) }

  // ── Validation ──────────────────────────────────────────────────
  const emailValid   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const pwStrength   = getStrength(password)
  const pwLong       = password.length >= 6
  const cfMatch      = confirm === password && confirm.length > 0
  const canRegister  = emailValid && pwLong && cfMatch && agreed
  const canLogin     = emailValid && password.length >= 1

  const fieldClass = (valid: boolean | null, dirty: boolean) =>
    `w-full px-3.5 py-2.5 bg-white dark:bg-gray-900 border rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600
     focus:outline-none focus:ring-2 transition-all pr-10 ${
       !dirty ? 'border-gray-200 dark:border-gray-700 focus:ring-blue-500/20 focus:border-blue-500'
       : valid  ? 'border-green-400 focus:ring-green-500/20 focus:border-green-400'
               : 'border-red-300 dark:border-red-500/50 focus:ring-red-500/20  focus:border-red-400'
     }`

  // ── Handlers ────────────────────────────────────────────────────
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault(); reset(); setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message === 'Invalid login credentials' ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : error.message)
      else { router.push('/'); router.refresh() }
    } finally { setLoading(false) }
  }, [email, password, supabase, router])

  const handleRegister = useCallback(async (e: React.FormEvent) => {
    e.preventDefault(); reset(); setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else { setSuccess('สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมลเพื่อยืนยันตัวตน'); setEmail(''); setPassword(''); setConfirm(''); setAgreed(false) }
    } finally { setLoading(false) }
  }, [email, password, supabase])

  const handleSocial = useCallback(async (provider: 'google' | 'line') => {
    reset(); setSocial(provider)
    try {
      const providerId = provider === 'line' ? 'kakao' : provider // LINE ใช้ provider ที่ config ใน Supabase
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider === 'google' ? 'google' : 'kakao',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) setError(error.message)
    } finally { setSocial(null) }
  }, [supabase])

  const switchTab = (t: Tab) => { setTab(t); reset(); setPassword(''); setConfirm('') }

  // ── UI ──────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center px-4 py-10 transition-colors">
      <div className="w-full max-w-sm sm:max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">QR Pay</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">PromptPay Generator</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors">

          {/* Tabs */}
          <div className="flex border-b border-gray-100 dark:border-gray-800">
            {(['login', 'register'] as const).map(t => (
              <button key={t} id={`tab-${t}`} onClick={() => switchTab(t)}
                className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                  tab === t ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}>
                {t === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
              </button>
            ))}
          </div>

          <div className="p-6 space-y-4">

            {/* Alert */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}
            {successMsg && (
              <div className="flex items-start gap-2.5 bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-3">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {successMsg}
              </div>
            )}

            {/* Social Buttons */}
            <div className="grid grid-cols-2 gap-3">
              {/* Google */}
              <button id="btn-google" onClick={() => handleSocial('google')} disabled={!!socialLoading || loading}
                className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
                {socialLoading === 'google'
                  ? <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  : <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                }
                Google
              </button>

              {/* LINE */}
              <button id="btn-line" onClick={() => handleSocial('line')} disabled={!!socialLoading || loading}
                className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
                {socialLoading === 'line'
                  ? <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#06C755">
                      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.105.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                    </svg>
                }
                LINE
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
              <span className="text-xs text-gray-400 dark:text-gray-500">หรือใช้อีเมล</span>
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
            </div>

            {/* Form */}
            <form id={tab === 'login' ? 'form-login' : 'form-register'}
              onSubmit={tab === 'login' ? handleLogin : handleRegister}
              noValidate className="space-y-4">

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  อีเมล
                </label>
                <div className="relative">
                  <input id="email" type="email" autoComplete="email" required
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    className={fieldClass(emailValid, email.length > 0)} />
                  {email.length > 0 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      {emailValid
                        ? <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                        : <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                      }
                    </span>
                  )}
                </div>
                {email.length > 0 && !emailValid && (
                  <p className="text-xs text-red-400 mt-1">รูปแบบอีเมลไม่ถูกต้อง</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <input id="password" type={showPw ? 'text' : 'password'}
                    autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                    required minLength={6}
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder={tab === 'register' ? 'อย่างน้อย 6 ตัวอักษร' : '••••••••'}
                    className={`${fieldClass(pwLong, password.length > 0)} pr-10`} />
                  <button type="button" id="toggle-password" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <EyeIcon open={showPw} />
                  </button>
                </div>
                {/* Password strength (register only) */}
                {tab === 'register' && password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[0,1,2,3].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                          i < pwStrength.score ? pwStrength.color : 'bg-gray-100'
                        }`} />
                      ))}
                    </div>
                    <p className="text-xs text-gray-400">
                      ความแข็งแรง: <span className="font-medium text-gray-600">{pwStrength.label}</span>
                      {!pwLong && <span className="text-red-400 ml-2">ต้องมีอย่างน้อย 6 ตัวอักษร</span>}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password (register only) */}
              {tab === 'register' && (
                <div>
                  <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    ยืนยันรหัสผ่าน
                  </label>
                  <div className="relative">
                    <input id="confirm" type={showCf ? 'text' : 'password'} autoComplete="new-password"
                      required value={confirm} onChange={e => setConfirm(e.target.value)}
                      placeholder="พิมพ์รหัสผ่านอีกครั้ง"
                      className={`${fieldClass(cfMatch, confirm.length > 0)} pr-10`} />
                    <button type="button" id="toggle-confirm" onClick={() => setShowCf(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <EyeIcon open={showCf} />
                    </button>
                  </div>
                  {confirm.length > 0 && !cfMatch && (
                    <p className="text-xs text-red-400 mt-1">รหัสผ่านไม่ตรงกัน</p>
                  )}
                </div>
              )}

              {/* Terms (register only) */}
              {tab === 'register' && (
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <div className="relative flex-shrink-0 mt-0.5">
                    <input id="terms" type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                      className="sr-only peer" />
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                      agreed ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                    }`}>
                      {agreed && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                        <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                      </svg>}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    ฉันยอมรับ{' '}
                    <a href="/terms" target="_blank" className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300">ข้อกำหนดการใช้บริการ</a>
                    {' '}และ{' '}
                    <a href="/privacy" target="_blank" className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300">นโยบายความเป็นส่วนตัว (PDPA)</a>
                  </span>
                </label>
              )}

              {/* Submit */}
              <button id={tab === 'login' ? 'btn-login' : 'btn-register'} type="submit"
                disabled={loading || (tab === 'login' ? !canLogin : !canRegister)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                           text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2">
                {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {loading ? 'กำลังดำเนินการ...' : tab === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
          🔒 ข้อมูลของคุณถูกเข้ารหัสและปลอดภัยตามมาตรฐาน PDPA
        </p>
      </div>
    </main>
  )
}

// ── Page Export (Suspense required for useSearchParams) ──────────
export default function AuthPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center transition-colors">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </main>
    }>
      <AuthForm />
    </Suspense>
  )
}

