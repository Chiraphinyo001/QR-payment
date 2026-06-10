'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { QrPayment } from '@/lib/database.types'
import QRCode from 'qrcode'

// ── Toast Notification ────────────────────────────────────────────
interface Toast {
  id: number
  message: string
  type: 'success' | 'info'
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className="flex items-center gap-2.5 px-4 py-3 bg-gray-900 text-white text-sm rounded-xl shadow-lg
                     animate-slide-in pointer-events-auto"
        >
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.type === 'success' ? 'bg-green-400' : 'bg-blue-400'}`} />
          {t.message}
        </div>
      ))}
    </div>
  )
}

// ── Live Indicator ────────────────────────────────────────────────
function LiveBadge({ connected }: { connected: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
      connected ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400 dark:bg-gray-600'}`} />
      {connected ? 'Live' : 'ออฟไลน์'}
    </span>
  )
}

// ── Main Component ────────────────────────────────────────────────
export default function PaymentHistory({ refreshKey }: { refreshKey?: number }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [payments, setPayments] = useState<QrPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [isLive, setIsLive] = useState(false)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastIdRef = useRef(0)
  const currentUserIdRef = useRef<string | null>(null)
  const limit = 8

  // ── ดึง userId ────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      currentUserIdRef.current = user?.id ?? null
    })
  }, [])

  // ── Toast helper ─────────────────────────────────────────────
  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  // ── Highlight helper ─────────────────────────────────────────
  const highlightNew = useCallback((id: string) => {
    setNewIds(prev => new Set([...prev, id]))
    setTimeout(() => {
      setNewIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }, 2500)
  }, [])

  // ── Fetch ─────────────────────────────────────────────────────
  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/payments?page=${page}&limit=${limit}`)
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json()
      setPayments(json.data ?? [])
      setTotal(json.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchPayments() }, [fetchPayments, refreshKey])

  // ── Realtime Subscription ─────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('qr_payments_live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'qr_payments' },
        (payload) => {
          const newItem = payload.new as QrPayment
          // กรองเฉพาะของ user นี้
          if (currentUserIdRef.current && newItem.user_id !== currentUserIdRef.current) return

          setPayments(prev => {
            if (page === 1) {
              return [newItem, ...prev].slice(0, limit)
            }
            return prev
          })
          setTotal(prev => prev + 1)
          highlightNew(newItem.id)
          if (page === 1) addToast('✨ สร้าง QR Code ใหม่แล้ว', 'success')
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'qr_payments' },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id
          setDeletingIds(prev => new Set([...prev, deletedId]))
          setTimeout(() => {
            setPayments(prev => prev.filter(p => p.id !== deletedId))
            setTotal(prev => Math.max(0, prev - 1))
            setDeletingIds(prev => { const s = new Set(prev); s.delete(deletedId); return s })
          }, 300)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'qr_payments' },
        (payload) => {
          const updated = payload.new as QrPayment
          setPayments(prev => prev.map(p => p.id === updated.id ? updated : p))
        }
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED')
      })

    return () => { supabase.removeChannel(channel) }
  }, [page, highlightNew, addToast])

  // ── Delete ───────────────────────────────────────────────────
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set())

  const handleDelete = async (id: string) => {
    if (!pendingDeleteIds.has(id)) {
      // คลิกแรก: แสดงสถานะ "ยืนยัน?"
      setPendingDeleteIds(prev => new Set([...prev, id]))
      setTimeout(() => {
        setPendingDeleteIds(prev => { const s = new Set(prev); s.delete(id); return s })
      }, 3000) // reset หลัง 3 วินาทีถ้าไม่ยืนยัน
      return
    }
    // คลิกสอง: ลบจริง
    setPendingDeleteIds(prev => { const s = new Set(prev); s.delete(id); return s })
    setDeletingIds(prev => new Set([...prev, id]))
    try {
      const res = await fetch(`/api/payments?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setTimeout(() => {
        setPayments(prev => prev.filter(p => p.id !== id))
        setTotal(prev => Math.max(0, prev - 1))
        setDeletingIds(prev => { const s = new Set(prev); s.delete(id); return s })
        addToast('ลบ QR Code แล้ว', 'info')
      }, 300)
    } catch (error) {
      setDeletingIds(prev => { const s = new Set(prev); s.delete(id); return s })
      addToast('เกิดข้อผิดพลาดในการลบ', 'info')
    }
  }

  // ── Download ─────────────────────────────────────────────────
  const handleDownload = async (payment: QrPayment) => {
    const dataUrl = await QRCode.toDataURL(payment.qr_payload, {
      width: 400, margin: 2, errorCorrectionLevel: 'M',
      color: { dark: '#111111', light: '#ffffff' },
    })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `qr-${payment.id.slice(0, 8)}.png`
    a.click()
  }

  const proxyTypeLabel: Record<string, string> = {
    phone: 'เบอร์โทร', national_id: 'บัตรปชช.', bank_account: 'บัญชีธนาคาร',
  }
  const totalPages = Math.ceil(total / limit)

  return (
    <>
      {/* Toast */}
      <ToastContainer toasts={toasts} onRemove={id => setToasts(prev => prev.filter(t => t.id !== id))} />

      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">ประวัติ การสร้าง QR Code แบบอัตโนมัติ</h2>
            <LiveBadge connected={isLive} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">{total} รายการ</span>
            <button
              onClick={fetchPayments}
              title="รีเฟรช"
              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            ยังไม่มีข้อมูล — สร้าง QR Code แรกเลย!
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map(p => (
              <div
                key={p.id}
                className={`flex items-center gap-3 p-3.5 border rounded-xl transition-all duration-300 ${
                  deletingIds.has(p.id)
                    ? 'opacity-0 scale-95 border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20'
                    : newIds.has(p.id)
                    ? 'border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/20 shadow-sm'
                    : 'bg-white dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
                }`}
              >
                {/* New indicator */}
                {newIds.has(p.id) && (
                  <span className="absolute -ml-1 w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                )}

                {/* Icon Badge by proxy type */}
                {p.proxy_type === 'phone' ? (
                  <span className="shrink-0 flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium rounded-lg">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    เบอร์โทร
                  </span>
                ) : p.proxy_type === 'bank_account' ? (
                  <span className="shrink-0 flex items-center gap-1 px-2 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-lg">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                    </svg>
                    บัญชีธนาคาร
                  </span>
                ) : (
                  <span className="shrink-0 flex items-center gap-1 px-2 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-medium rounded-lg">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                    </svg>
                    บัตรปชช.
                  </span>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-gray-800 dark:text-gray-200 truncate">{p.proxy_value}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {p.bank_name && <span className="mr-2">{p.bank_name}</span>}
                    {p.recipient_name && <span className="mr-2">· {p.recipient_name}</span>}
                    {new Date(p.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>

                {/* Amount */}
                {p.amount && (
                  <span className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white font-mono">
                    ฿{Number(p.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </span>
                )}

                {/* scan_count */}
                {p.scan_count > 0 && (
                  <span className="shrink-0 flex items-center gap-1 text-xs text-gray-400">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {p.scan_count}
                  </span>
                )}

                {/* Actions */}
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleDownload(p)}
                    title="ดาวน์โหลด"
                    className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    title={pendingDeleteIds.has(p.id) ? 'คลิกอีกครั้งเพื่อยืนยันลบ' : 'ลบ'}
                    disabled={deletingIds.has(p.id)}
                    className={`flex items-center gap-1 rounded-lg transition-all duration-200 disabled:opacity-50 ${
                      pendingDeleteIds.has(p.id)
                        ? 'px-2 py-1 bg-red-500 text-white text-xs font-medium hover:bg-red-600'
                        : 'p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'
                    }`}
                  >
                    {pendingDeleteIds.has(p.id) ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        ยืนยัน?
                      </>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              ← ก่อนหน้า
            </button>
            <span className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              ถัดไป →
            </button>
          </div>
        )}
      </div>
    </>
  )
}
