'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { QrPayment } from '@/lib/database.types'
import QRCode from 'qrcode'

export default function PaymentHistory({ refreshKey }: { refreshKey?: number }) {
  const [payments, setPayments] = useState<QrPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 8

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/payments?page=${page}&limit=${limit}`)
    const json = await res.json()
    setPayments(json.data ?? [])
    setTotal(json.total ?? 0)
    setLoading(false)
  }, [page])

  useEffect(() => { fetchPayments() }, [fetchPayments, refreshKey])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('qr_payments_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'qr_payments' }, () => {
        fetchPayments()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchPayments])

  const handleDelete = async (id: string) => {
    if (!confirm('ลบ QR Code นี้?')) return
    await fetch(`/api/payments?id=${id}`, { method: 'DELETE' })
    fetchPayments()
  }

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
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">ประวัติ QR Code</h2>
        <span className="text-sm text-gray-500">{total} รายการ</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">กำลังโหลด...</div>
      ) : payments.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">ยังไม่มีข้อมูล</div>
      ) : (
        <div className="space-y-2">
          {payments.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3.5 bg-white border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
              {/* Badge */}
              <span className="shrink-0 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                {proxyTypeLabel[p.proxy_type]}
              </span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono text-gray-800 truncate">{p.proxy_value}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {p.bank_name && <span className="mr-2">{p.bank_name}</span>}
                  {p.recipient_name && <span className="mr-2">· {p.recipient_name}</span>}
                  {new Date(p.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>

              {/* Amount */}
              {p.amount && (
                <span className="shrink-0 text-sm font-semibold text-gray-900 font-mono">
                  ฿{Number(p.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              )}

              {/* Actions */}
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => handleDownload(p)}
                  title="ดาวน์โหลด"
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  title="ลบ"
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
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
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            ← ก่อนหน้า
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            ถัดไป →
          </button>
        </div>
      )}
    </div>
  )
}
