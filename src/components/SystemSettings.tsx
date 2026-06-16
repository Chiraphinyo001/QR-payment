'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

interface SystemSettingsProps {
  paymentId: string
  userId: string
  lineToken: string | null
  expiresInMinutes: number | null
  expiresAt: string | null
  onUpdate: (fields: Record<string, any>) => void
}

interface BlacklistEntry {
  id: string
  identifier: string
  identifier_type: string
  reason: string | null
  created_at: string
}

export default function SystemSettings({
  paymentId,
  userId,
  lineToken: initLineToken,
  expiresInMinutes: initExpiry,
  expiresAt: initExpiresAt,
  onUpdate,
}: SystemSettingsProps) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // LINE Notify
  const [lineToken, setLineToken] = useState(initLineToken || '')
  const [savingLine, setSavingLine] = useState(false)
  const [lineMsg, setLineMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [testingLine, setTestingLine] = useState(false)

  // QR Expiry
  const [expiryMin, setExpiryMin] = useState<string>(initExpiry ? String(initExpiry) : '')
  const [savingExpiry, setSavingExpiry] = useState(false)
  const [expiryMsg, setExpiryMsg] = useState<string | null>(null)

  // Blacklist
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([])
  const [loadingBl, setLoadingBl] = useState(false)
  const [newIdentifier, setNewIdentifier] = useState('')
  const [newReason, setNewReason] = useState('')
  const [addingBl, setAddingBl] = useState(false)
  const [blMsg, setBlMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Load blacklist
  useEffect(() => {
    const load = async () => {
      setLoadingBl(true)
      try {
        const { data } = await supabase
          .from('slip_blacklist')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
        setBlacklist((data as any) ?? [])
      } finally {
        setLoadingBl(false)
      }
    }
    load()
  }, [userId])

  // ── LINE Token ───────────────────────────────────────────────
  const saveLineToken = async () => {
    setSavingLine(true)
    setLineMsg(null)
    try {
      const res = await fetch(`/api/payments?id=${paymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_notify_token: lineToken || null }),
      })
      if (!res.ok) throw new Error('บันทึกล้มเหลว')
      setLineMsg({ type: 'ok', text: 'บันทึก LINE Token สำเร็จ' })
      onUpdate({ line_notify_token: lineToken || null })
    } catch (e: any) {
      setLineMsg({ type: 'err', text: e.message })
    } finally {
      setSavingLine(false)
    }
  }

  const testLineNotify = async () => {
    if (!lineToken) return
    setTestingLine(true)
    try {
      await fetch('https://notify-api.line.me/api/notify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${lineToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          message: '\n✅ ทดสอบ LINE Notify\nระบบ QR Payment เชื่อมต่อสำเร็จ!',
        }),
      })
      setLineMsg({ type: 'ok', text: 'ส่งการทดสอบไปยัง LINE แล้ว ตรวจสอบโทรศัพท์ได้เลย' })
    } catch {
      setLineMsg({ type: 'err', text: 'ไม่สามารถส่งได้ (ตรวจสอบ Token อีกครั้ง)' })
    } finally {
      setTestingLine(false)
    }
  }

  // ── QR Expiry ────────────────────────────────────────────────
  const saveExpiry = async () => {
    setSavingExpiry(true)
    setExpiryMsg(null)
    try {
      const min = expiryMin ? parseInt(expiryMin) : null
      const res = await fetch(`/api/payments?id=${paymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expires_in_minutes: min,
          expires_at: min ? new Date(Date.now() + min * 60 * 1000).toISOString() : null,
        }),
      })
      if (!res.ok) throw new Error('บันทึกล้มเหลว')
      setExpiryMsg(min ? `QR หมดอายุใน ${min} นาที` : 'ปิดการหมดอายุแล้ว')
      onUpdate({ expires_in_minutes: min })
    } catch (e: any) {
      setExpiryMsg('เกิดข้อผิดพลาด')
    } finally {
      setSavingExpiry(false)
    }
  }

  // ── Blacklist ────────────────────────────────────────────────
  const addBlacklist = async () => {
    if (!newIdentifier.trim()) return
    setAddingBl(true)
    setBlMsg(null)
    try {
      const res = await fetch('/api/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          identifier: newIdentifier.trim(),
          reason: newReason.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'เกิดข้อผิดพลาด')
      setBlacklist(prev => [json.data, ...prev])
      setNewIdentifier('')
      setNewReason('')
      setBlMsg({ type: 'ok', text: 'เพิ่ม Blacklist สำเร็จ' })
    } catch (e: any) {
      setBlMsg({ type: 'err', text: e.message })
    } finally {
      setAddingBl(false)
    }
  }

  const removeBlacklist = async (id: string) => {
    try {
      await fetch(`/api/blacklist?id=${id}`, { method: 'DELETE' })
      setBlacklist(prev => prev.filter(b => b.id !== id))
    } catch {}
  }

  return (
    <div className="space-y-6">

      {/* ── LINE Notify ── */}
      <section className="rounded-2xl border border-gray-100 dark:border-white/[0.06] bg-white dark:bg-[#161b27] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06] flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-500/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">LINE Notify</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500">แจ้งเตือนเมื่อมีการชำระเงิน</p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">LINE Notify Token</label>
            <input
              type="password"
              value={lineToken}
              onChange={e => setLineToken(e.target.value)}
              placeholder="วาง Token ที่ได้จาก notify-bot.line.me"
              className="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500/60 font-mono"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500">
              รับ Token ได้ที่{' '}
              <a href="https://notify-bot.line.me/my/" target="_blank" rel="noreferrer"
                className="text-green-600 dark:text-green-400 underline">notify-bot.line.me</a>
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={saveLineToken} disabled={savingLine}
              className="flex-1 py-2 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors disabled:opacity-50">
              {savingLine ? 'กำลังบันทึก...' : 'บันทึก Token'}
            </button>
            <button onClick={testLineNotify} disabled={!lineToken || testingLine}
              className="px-3 py-2 text-xs font-semibold border border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400 rounded-xl hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors disabled:opacity-40">
              {testingLine ? '...' : 'ทดสอบ'}
            </button>
          </div>
          {lineMsg && (
            <p className={`text-xs font-medium ${lineMsg.type === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {lineMsg.type === 'ok' ? '✓' : '✗'} {lineMsg.text}
            </p>
          )}
        </div>
      </section>

      {/* ── QR Expiry ── */}
      <section className="rounded-2xl border border-gray-100 dark:border-white/[0.06] bg-white dark:bg-[#161b27] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06] flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">QR Expiry — กำหนดอายุ QR</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500">ป้องกัน QR เก่าถูกนำกลับมาใช้</p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">หมดอายุหลัง (นาที)</label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={expiryMin}
                onChange={e => setExpiryMin(e.target.value)}
                placeholder="ว่าง = ไม่หมดอายุ"
                min="1" max="10080"
                className="flex-1 px-3 py-2.5 text-sm bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/60 font-mono"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[{ label: '15 นาที', val: '15' }, { label: '30 นาที', val: '30' }, { label: '1 ชม.', val: '60' }, { label: '24 ชม.', val: '1440' }].map(opt => (
                <button key={opt.val} onClick={() => setExpiryMin(opt.val)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                    expiryMin === opt.val
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:border-amber-300 dark:hover:border-amber-500/30'
                  }`}>
                  {opt.label}
                </button>
              ))}
              <button onClick={() => setExpiryMin('')}
                className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-white/10 text-gray-400 hover:text-rose-500 transition-colors">
                ปิด
              </button>
            </div>
          </div>
          <button onClick={saveExpiry} disabled={savingExpiry}
            className="w-full py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors disabled:opacity-50">
            {savingExpiry ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
          </button>
          {expiryMsg && (
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">⏱ {expiryMsg}</p>
          )}
        </div>
      </section>

      {/* ── Blacklist ── */}
      <section className="rounded-2xl border border-gray-100 dark:border-white/[0.06] bg-white dark:bg-[#161b27] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06] flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Blacklist บัญชี</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500">บล็อกบัญชีที่ส่งสลิปปลอมซ้ำๆ</p>
          </div>
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{blacklist.length} รายการ</span>
        </div>
        <div className="p-4 space-y-3">
          {/* Add form */}
          <div className="space-y-2">
            <input
              type="text"
              value={newIdentifier}
              onChange={e => setNewIdentifier(e.target.value)}
              placeholder="เบอร์โทร / เลขบัญชี / ชื่อผู้โอน"
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/60"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={newReason}
                onChange={e => setNewReason(e.target.value)}
                placeholder="เหตุผล (ไม่บังคับ)"
                className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/60"
              />
              <button onClick={addBlacklist} disabled={!newIdentifier.trim() || addingBl}
                className="px-3 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors disabled:opacity-40">
                {addingBl ? '...' : '+ เพิ่ม'}
              </button>
            </div>
          </div>
          {blMsg && (
            <p className={`text-xs font-medium ${blMsg.type === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {blMsg.type === 'ok' ? '✓' : '✗'} {blMsg.text}
            </p>
          )}

          {/* List */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {loadingBl ? (
              <div className="text-center py-3 text-xs text-gray-400">กำลังโหลด...</div>
            ) : blacklist.length === 0 ? (
              <div className="text-center py-4 text-xs text-gray-400 dark:text-gray-600">
                ยังไม่มีรายการ Blacklist
              </div>
            ) : (
              blacklist.map(b => (
                <div key={b.id} className="flex items-start justify-between gap-2 px-3 py-2 bg-rose-50 dark:bg-rose-500/5 border border-rose-100 dark:border-rose-500/10 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-900 dark:text-white font-mono truncate">{b.identifier}</p>
                    {b.reason && <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{b.reason}</p>}
                    <p className="text-[10px] text-gray-400 dark:text-gray-600">{new Date(b.created_at).toLocaleDateString('th-TH')}</p>
                  </div>
                  <button onClick={() => removeBlacklist(b.id)}
                    className="flex-shrink-0 p-1 text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

    </div>
  )
}
