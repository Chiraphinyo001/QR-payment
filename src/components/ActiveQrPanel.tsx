'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { createBrowserClient } from '@supabase/ssr'
import QRCode from 'qrcode'
import type { QrPayment } from '@/lib/database.types'

// ── Spinner ────────────────────────────────────────────────────────
function SpinnerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      style={{ color: '#6366f1' }}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  )
}

// ── Pulse dot ─────────────────────────────────────────────────────
function PulseDot({ color = 'bg-green-400' }: { color?: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-60`} />
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color}`} />
    </span>
  )
}

// ── Format proxy value ─────────────────────────────────────────────
function formatProxy(value: string, type: string): string {
  if (type === 'phone') {
    const d = value.replace(/\D/g, '')
    if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
    return value
  }
  return value
}

// ── Label for proxy type ───────────────────────────────────────────
function proxyLabel(type: string): string {
  if (type === 'phone') return 'เบอร์โทรศัพท์มือถือ'
  if (type === 'bank_account') return 'เลขบัญชีธนาคาร'
  return 'เลขประจำตัวประชาชน'
}

// ── Dashboard Modal ────────────────────────────────────────────────
function DashboardModal({ item, onClose, onDelete }: { item: QrPayment; onClose: () => void; onDelete: () => void }) {
  const [notifySuccess, setNotifySuccess] = useState(item.notify_success ?? true)
  const [notifyFail, setNotifyFail] = useState(item.notify_fail ?? true)
  const [isPaused, setIsPaused] = useState(item.is_paused ?? false)
  const [transactions, setTransactions] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    // ดึงประวัติรายการล่าสุด
    const fetchTransactions = async () => {
      setLoadingHistory(true)
      const { data } = await supabase
        .from('qr_transactions')
        .select('*')
        .eq('payment_id', item.id)
        .order('created_at', { ascending: false })
        .limit(10)
      setTransactions(data ?? [])
      setLoadingHistory(false)
    }

    fetchTransactions()

    // Realtime subscription สำหรับตาราง transactions
    const channel = supabase
      .channel(`transactions_${item.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'qr_transactions', filter: `payment_id=eq.${item.id}` },
        (payload) => {
          setTransactions(prev => [payload.new, ...prev].slice(0, 10))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [item.id, supabase])

  // คำนวณสถิติ
  const successCount = transactions.filter(t => t.status === 'success').length
  const totalAmountMonth = transactions
    .filter(t => t.status === 'success' && new Date(t.created_at).getMonth() === new Date().getMonth())
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const lastSuccess = transactions.find(t => t.status === 'success')

  const updateSetting = async (field: string, value: any) => {
    try {
      await fetch(`/api/payments?id=${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      })
    } catch (e) {
      console.error('Update failed', e)
    }
  }

  const handleToggleNotifySuccess = () => {
    const nextVal = !notifySuccess
    setNotifySuccess(nextVal)
    updateSetting('notify_success', nextVal)
  }

  const handleToggleNotifyFail = () => {
    const nextVal = !notifyFail
    setNotifyFail(nextVal)
    updateSetting('notify_fail', nextVal)
  }

  const handleTogglePause = () => {
    const nextVal = !isPaused
    setIsPaused(nextVal)
    updateSetting('is_paused', nextVal)
  }



  const handleDelete = () => {
    if (confirm('คุณต้องการลบระบบชำระเงินนี้ใช่หรือไม่?')) {
      onDelete()
    }
  }

  if (typeof window === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-50 dark:bg-[#121621] overflow-y-auto animate-fade-in text-gray-800 dark:text-gray-200 font-sans">

      {/* Header - Fixed top left */}
      <div className="sticky top-0 z-[10000] bg-white/90 dark:bg-[#121621]/90 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-800/50 shadow-sm dark:shadow-none">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all flex items-center gap-2 text-sm font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            กลับ
          </button>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">ระบบชำระเงินอัตโนมัติ</h2>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-[10px] font-semibold tracking-wide flex items-center gap-2 ${isPaused ? 'bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400' : 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
          <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-orange-500 dark:bg-orange-400' : 'bg-emerald-500 dark:bg-emerald-400 animate-pulse'}`} />
          {isPaused ? 'ปิด' : 'กำลังทำงาน'}
        </span>
      </div>

      <div className="w-full max-w-2xl mx-auto bg-slate-50 dark:bg-[#121621] sm:mt-6 sm:rounded-3xl min-h-screen sm:min-h-0 pb-10">

        <div className="p-4 space-y-6">

          {/* ข้อมูลผู้รับเงิน */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">ข้อมูลผู้รับเงิน</h3>
            <div className="bg-white dark:bg-[#1A1F2C] rounded-2xl border border-gray-200 dark:border-gray-800/60 p-4 space-y-4 shadow-sm dark:shadow-none">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2.5 text-gray-500 dark:text-gray-400">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800/50 flex items-center justify-center">
                    {item.proxy_type === 'bank_account' ? (
                      <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                      </svg>
                    ) : item.proxy_type === 'national_id' ? (
                      <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm">{proxyLabel(item.proxy_type)}</span>
                </div>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400 font-mono">{formatProxy(item.proxy_value, item.proxy_type)}</span>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2.5 text-gray-500 dark:text-gray-400">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800/50 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm">จำนวนเงินต่อครั้ง</span>
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white font-mono">{item.amount ? `฿${Number(item.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}` : 'ทุกจำนวน'}</span>
              </div>
            </div>
          </section>

          {/* สถิติการชำระเงิน */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">สถิติการชำระเงิน</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-[#1A1F2C] rounded-2xl border border-gray-200 dark:border-gray-800/60 p-4 shadow-sm dark:shadow-none">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">สำเร็จทั้งหมด</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{successCount}</span>
                  <span className="text-xs text-gray-500">ครั้ง</span>
                </div>
              </div>
              <div className="bg-white dark:bg-[#1A1F2C] rounded-2xl border border-gray-200 dark:border-gray-800/60 p-4 shadow-sm dark:shadow-none">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">ยอดรวมเดือนนี้</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-gray-900 dark:text-white">฿{totalAmountMonth.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">เดือนปัจจุบัน</p>
              </div>
              <div className="bg-white dark:bg-[#1A1F2C] rounded-2xl border border-gray-200 dark:border-gray-800/60 p-4 shadow-sm dark:shadow-none">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">ชำระล่าสุด</p>
                <p className="text-base font-bold text-gray-900 dark:text-white tracking-wide">
                  {lastSuccess ? new Date(lastSuccess.created_at).toLocaleDateString('th-TH') : '-'}
                </p>
                {lastSuccess && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">สำเร็จ</p>}
              </div>
              <div className="bg-white dark:bg-[#1A1F2C] rounded-2xl border border-gray-200 dark:border-gray-800/60 p-4 shadow-sm dark:shadow-none">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">ครั้งถัดไป</p>
                <p className="text-base font-bold text-gray-900 dark:text-white tracking-wide">-</p>
                <p className="text-[10px] text-gray-500 mt-0.5">ตามเงื่อนไข</p>
              </div>
            </div>
          </section>

          {/* การแจ้งเตือน & ตั้งค่า */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">การแจ้งเตือน & ตั้งค่า</h3>
            <div className="bg-white dark:bg-[#1A1F2C] rounded-2xl border border-gray-200 dark:border-gray-800/60 p-2 divide-y divide-gray-100 dark:divide-gray-800/60 shadow-sm dark:shadow-none">

              <label className="flex items-center justify-between p-3 cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800/50 flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">แจ้งเตือนเมื่อชำระสำเร็จ</p>
                    <p className="text-[10px] text-gray-500">รับ push notification ทุกครั้งที่ชำระสำเร็จ</p>
                  </div>
                </div>
                <div className="relative">
                  <input type="checkbox" className="sr-only peer" checked={notifySuccess} onChange={handleToggleNotifySuccess} />
                  <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </div>
              </label>

              <label className="flex items-center justify-between p-3 cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800/50 flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">แจ้งเตือนเมื่อชำระล้มเหลว</p>
                    <p className="text-[10px] text-gray-500">แจ้งเตือนหากเงินไม่พอหรือมีข้อผิดพลาด</p>
                  </div>
                </div>
                <div className="relative">
                  <input type="checkbox" className="sr-only peer" checked={notifyFail} onChange={handleToggleNotifyFail} />
                  <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </div>
              </label>

              <label className="flex items-center justify-between p-3 cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800/50 flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">ปิดการใช้งาน</p>
                    <p className="text-[10px] text-gray-500">ระงับการชำระอัตโนมัติโดยไม่ลบรายการ</p>
                  </div>
                </div>
                <div className="relative">
                  <input type="checkbox" className="sr-only peer" checked={isPaused} onChange={handleTogglePause} />
                  <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </div>
              </label>

            </div>
          </section>

          {/* ประวัติล่าสุด */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">ประวัติล่าสุด</h3>
            <div className="bg-white dark:bg-[#1A1F2C] rounded-2xl border border-gray-200 dark:border-gray-800/60 p-2 divide-y divide-gray-100 dark:divide-gray-800/60 shadow-sm dark:shadow-none">
              {loadingHistory ? (
                <div className="p-4 text-center text-sm text-gray-500 animate-pulse">กำลังโหลด...</div>
              ) : transactions.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">ยังไม่มีประวัติการทำรายการ</div>
              ) : (
                transactions.map((t, i) => {
                  const statusColor = t.status === 'success' ? 'emerald' : t.status === 'failed' ? 'rose' : 'amber'
                  const statusText = t.status === 'success' ? 'สำเร็จ' : t.status === 'failed' ? (t.error_message || 'ล้มเหลว') : 'รอชำระเงิน'
                  return (
                    <div key={t.id || i} className="flex justify-between items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full bg-${statusColor}-500 flex-shrink-0 mt-0.5`} />
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.recipient_name || formatProxy(item.proxy_value, item.proxy_type)}</p>
                          <p className="text-[10px] text-gray-500">{new Date(t.created_at).toLocaleString('th-TH')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900 dark:text-white font-mono">฿{Number(t.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>
                        <p className={`text-[10px] font-medium text-${statusColor}-500 dark:text-${statusColor}-400`}>{statusText}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>

          {/* การจัดการ */}
          <section className="space-y-3 pb-6">
            <h3 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">การจัดการ</h3>
            <div className="space-y-2">

              <button className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#1A1F2C] border border-gray-200 dark:border-gray-800/60 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-all rounded-2xl group shadow-sm dark:shadow-none">
                <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span className="text-sm font-medium">การเชื่อมต่อระบบ</span>
                </div>
                <span className="text-[10px] bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2.5 py-1 rounded-full font-medium">API / Webhook</span>
              </button>
              <button className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#1A1F2C] border border-gray-200 dark:border-gray-800/60 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-all rounded-2xl group shadow-sm dark:shadow-none">
                <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span className="text-sm font-medium">ส่งออกประวัติการชำระเงิน (CSV)</span>
                </div>
              </button>

              <button onClick={handleDelete} className="w-full flex items-center justify-center p-4 bg-white dark:bg-[#1A1F2C] border border-rose-200 dark:border-rose-900/30 hover:border-rose-300 dark:hover:border-rose-500/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all rounded-2xl group mt-4 shadow-sm dark:shadow-none">
                <div className="flex items-center gap-2 text-rose-500 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span className="text-sm font-semibold">ลบระบบชำระเงินนี้</span>
                </div>
              </button>

            </div>
          </section>

        </div>
      </div>
    </div>,
    document.body
  )
}


// ── Three-dot menu per item ─────────────────────────────────────────
function ItemMenu({
  item,
  isPaused,
  onDashboard,
  onClose,
  onDelete,
}: {
  item: QrPayment
  isPaused: boolean
  onDashboard: () => void
  onClose: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.closest('[data-menu-root]')?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setMenuPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      })
    }
    setOpen(v => !v)
  }

  const handleDelete = async () => {
    setDeleting(true)
    setOpen(false)
    onDelete()
  }

  return (
    <div data-menu-root="1" className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="ตัวเลือก"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {open && (
        <div
          style={{ top: menuPos.top, right: menuPos.right, position: 'fixed' }}
          className="w-36 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 overflow-hidden z-[9999] animate-fade-in"
        >
          {/* แดชบอร์ด */}
          <button
            onClick={() => { setOpen(false); onDashboard() }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
          >
            <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            แดชบอร์ด
          </button>

          {/* ปิด / เปิด */}
          <button
            onClick={() => { setOpen(false); onClose() }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
          >
            {isPaused ? (
              <>
                <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                เปิด
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ปิด
              </>
            )}
          </button>

          <div className="mx-2 border-t border-gray-100 dark:border-gray-800" />

          {/* ลบ */}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-left disabled:opacity-50"
          >
            {deleting ? (
              <span className="w-3.5 h-3.5 border border-red-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
            ลบ
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────
export default function ActiveQrPanel({ refreshKey }: { refreshKey?: number }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [activeItems, setActiveItems] = useState<QrPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [stoppedIds, setStoppedIds] = useState<Set<string>>(new Set())
  const [dashboardItem, setDashboardItem] = useState<QrPayment | null>(null)
  const currentUserIdRef = useRef<string | null>(null)

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      currentUserIdRef.current = user?.id ?? null
    })
  }, [])

  // Fetch recent 10 items
  const fetchActive = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('qr_payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
      setActiveItems(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchActive() }, [fetchActive, refreshKey])

  // Highlight new item
  const highlightNew = useCallback((id: string) => {
    setNewIds(prev => new Set([...prev, id]))
    setTimeout(() => {
      setNewIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }, 4000)
  }, [])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`active_qr_panel_${Math.random()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'qr_payments' },
        (payload) => {
          const newItem = payload.new as QrPayment
          if (currentUserIdRef.current && newItem.user_id !== currentUserIdRef.current) return
          setActiveItems(prev => {
            if (prev.some(p => p.id === newItem.id)) return prev
            return [newItem, ...prev].slice(0, 10)
          })
          highlightNew(newItem.id)
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'qr_payments' },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id
          setActiveItems(prev => prev.filter(p => p.id !== deletedId))
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'qr_payments' },
        (payload) => {
          const updatedItem = payload.new as QrPayment
          if (currentUserIdRef.current && updatedItem.user_id !== currentUserIdRef.current) return
          setActiveItems(prev => prev.map(p => p.id === updatedItem.id ? updatedItem : p))
        }
      )

    channel.subscribe(status => setIsLive(status === 'SUBSCRIBED'))
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightNew])

  // ── Actions ──────────────────────────────────────────────────────

  // ปิด/เริ่ม — toggle สถานะ "ปิด" ↔ กำลังดำเนินการ
  const handleClose = async (id: string) => {
    const itemToUpdate = activeItems.find(p => p.id === id)
    if (!itemToUpdate) return

    const nextVal = !itemToUpdate.is_paused

    // Optimistic Update
    setActiveItems(prev => prev.map(p => p.id === id ? { ...p, is_paused: nextVal } : p))

    // API Call
    try {
      const res = await fetch(`/api/payments?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_paused: nextVal })
      })
      if (!res.ok) throw new Error('Update failed')
    } catch (e) {
      console.error('Failed to toggle pause status:', e)
      // Revert if failed
      setActiveItems(prev => prev.map(p => p.id === id ? { ...p, is_paused: !nextVal } : p))
    }
  }

  // ลบ — เรียก /api/payments (admin bypass RLS) ลบได้ทุก record
  const handleDelete = async (id: string) => {
    // Keep a backup of the item in case delete fails
    const itemToDelete = activeItems.find(p => p.id === id)

    setActiveItems(prev => prev.filter(p => p.id !== id))
    setStoppedIds(prev => { const s = new Set(prev); s.delete(id); return s })

    try {
      const res = await fetch(`/api/payments?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
    } catch (e) {
      console.error('Failed to delete item:', e)
      // Revert if failed
      if (itemToDelete) {
        setActiveItems(prev => [itemToDelete, ...prev].sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ))
      }
    }
  }

  const activeCount = activeItems.length

  return (
    <>
      {/* Dashboard Modal */}
      {dashboardItem && (
        <DashboardModal
          item={dashboardItem}
          onClose={() => setDashboardItem(null)}
          onDelete={() => { handleDelete(dashboardItem.id); setDashboardItem(null); }}
        />
      )}

      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PulseDot color={isLive ? 'bg-green-400' : 'bg-gray-400'} />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              ระบบชำระเงินอัตโนมัติ
            </h3>
          </div>
          {/* Active count badge */}
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${activeCount > 0
            ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-700'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
            }`}>
            {activeCount > 0 && <SpinnerIcon size={10} />}
            <span>{activeCount}</span>
            <span className="opacity-70">Active</span>
          </span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800/60 rounded-xl animate-pulse" />
            ))
          ) : activeItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
              <svg className="w-10 h-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-center">ยังไม่มี QR Code<br />กำลังทำงาน</p>
            </div>
          ) : (
            activeItems.map(item => {
              const isStopped = item.is_paused ?? false
              const isNew = newIds.has(item.id)
              return (
                <div
                  key={item.id}
                  className={`relative rounded-xl border px-3 py-2.5 transition-all duration-500 ${isStopped
                    ? 'border-red-300 dark:border-red-700/60 bg-red-50 dark:bg-red-900/20'
                    : isNew
                      ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 shadow-md shadow-indigo-100 dark:shadow-indigo-900/40'
                      : 'bg-white dark:bg-gray-800/60 border-gray-100 dark:border-gray-700/60 hover:border-gray-200 dark:hover:border-gray-600'
                    }`}
                >
                  {/* Top accent bar */}
                  {isStopped ? (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-400 via-rose-400 to-red-500" />
                  ) : isNew ? (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 animate-pulse" />
                  ) : null}

                  {/* Top row: status + 3-dot menu */}
                  <div className="flex items-center justify-between mb-1.5">
                    {isStopped ? (
                      /* ปิด — red badge */
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-2 w-2 rounded-full bg-red-500" />
                        <span className="text-[11px] text-red-600 dark:text-red-400 font-semibold tracking-wide">
                          ปิด
                        </span>
                      </div>
                    ) : (
                      /* กำลังดำเนินการ — indigo spinner */
                      <div className="flex items-center gap-1.5">
                        <SpinnerIcon size={12} />
                        <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                          ระบบกำลังดำเนินการ...
                        </span>
                      </div>
                    )}

                    {/* ⋯ Menu */}
                    <ItemMenu
                      item={item}
                      isPaused={isStopped}
                      onDashboard={() => setDashboardItem(item)}
                      onClose={() => handleClose(item.id)}
                      onDelete={() => handleDelete(item.id)}
                    />
                  </div>

                  {/* Label + value — icon ตาม proxy_type */}
                  <div className="flex items-center gap-1.5">
                    {item.proxy_type === 'bank_account' ? (
                      /* ไอคอนธนาคาร */
                      <svg
                        className={`w-3 h-3 shrink-0 ${isStopped ? 'text-red-400' : 'text-amber-500'}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                      </svg>
                    ) : (
                      /* ไอคอนโทรศัพท์ */
                      <svg
                        className={`w-3 h-3 shrink-0 ${isStopped ? 'text-red-400' : 'text-blue-400'}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    )}
                    <span className={`text-[10px] ${isStopped ? 'text-red-400 dark:text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                      {item.proxy_type === 'bank_account' ? 'เลขบัญชีธนาคาร' : item.proxy_type === 'phone' ? 'เบอร์โทรศัพท์มือถือ' : 'เลขประจำตัวประชาชน'}
                    </span>
                  </div>
                  <p className={`text-sm font-semibold font-mono mt-0.5 ml-0.5 ${isStopped ? 'text-red-700 dark:text-red-300' : 'text-gray-800 dark:text-gray-100'}`}>
                    {formatProxy(item.proxy_value, item.proxy_type)}
                  </p>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        {!loading && activeItems.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
              <span>แสดง {activeItems.length} รายการล่าสุด</span>
              <span className={`flex items-center gap-1 ${isLive ? 'text-green-500' : 'text-gray-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                {isLive ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
