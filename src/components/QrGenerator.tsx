'use client'

import { useState, useCallback } from 'react'
import QRCode from 'qrcode'
import type { GenerateRequest, GenerateResponse } from '@/app/api/generate/route'
import DashboardStats from './DashboardStats'

const BANKS = [
  { code: '014', name: 'กรุงไทย (KTB)' },
  { code: '004', name: 'กสิกรไทย (KBANK)' },
  { code: '002', name: 'กรุงเทพ (BBL)' },
  { code: '025', name: 'กรุงศรีอยุธยา (BAY)' },
  { code: '030', name: 'ไทยพาณิชย์ (SCB)' },
  { code: '011', name: 'ทหารไทยธนชาต (TTB)' },
  { code: '022', name: 'ซีไอเอ็มบี (CIMB)' },
  { code: '067', name: 'ทิสโก้ (TISCO)' },
  { code: '024', name: 'ยูโอบี (UOB)' },
  { code: '069', name: 'เกียรตินาคินภัทร (KKP)' },
]

type Tab = 'phone' | 'bank_account'

export default function QrGenerator({ onGenerated }: { onGenerated?: () => void }) {
  const [tab, setTab] = useState<Tab>('phone')
  const [phone, setPhone] = useState('')
  const [bankCode, setBankCode] = useState('')
  const [accountNo, setAccountNo] = useState('')
  const [amount, setAmount] = useState('')
  const [anyAmount, setAnyAmount] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [result, setResult] = useState<GenerateResponse | null>(null)

  const handleGenerate = useCallback(async () => {
    setError('')
    setLoading(true)
    const payload: GenerateRequest = {
      proxyType: tab,
      proxyValue: tab === 'phone' ? phone : accountNo,
      bankCode: tab === 'bank_account' ? bankCode : undefined,
      bankName: tab === 'bank_account' ? BANKS.find(b => b.code === bankCode)?.name : undefined,
      amount: anyAmount ? undefined : (amount ? parseFloat(amount) : undefined),
    }
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')
      const dataUrl = await QRCode.toDataURL(data.qrPayload, {
        width: 320, margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#111827', light: '#ffffff' },
      })
      setQrDataUrl(dataUrl)
      setResult(data)
      onGenerated?.()
      setPhone(''); setBankCode(''); setAccountNo('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [tab, phone, bankCode, accountNo, amount, anyAmount, onGenerated])

  const handleDownload = () => {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `qr-${result?.id?.slice(0, 8) ?? 'promptpay'}.png`
    a.click()
  }

  const tabs = [
    { id: 'phone' as Tab, label: 'เบอร์โทรศัพท์', icon: '📱' },
    { id: 'bank_account' as Tab, label: 'เลขบัญชี', icon: '🏦' },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── Form ── */}
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">สร้าง QR Code</h2>
          <p className="text-xs text-gray-400 mt-0.5">เพิ่มบัญชีรับชำระเงิน PromptPay</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100/80 dark:bg-white/5 rounded-xl p-1 gap-1 border border-gray-200/50 dark:border-white/5">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(''); setQrDataUrl(''); setResult(null) }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
                tab === t.id
                  ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm border border-gray-100 dark:border-white/10'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* Phone input */}
        {tab === 'phone' && (
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">หมายเลขโทรศัพท์</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">📱</span>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="0812345678"
                className="input-premium pl-9 font-mono tracking-wider"
              />
            </div>
          </div>
        )}

        {/* Bank account */}
        {tab === 'bank_account' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">ธนาคาร</label>
              <select
                value={bankCode}
                onChange={e => setBankCode(e.target.value)}
                className="input-premium"
              >
                <option value="">— เลือกธนาคาร —</option>
                {BANKS.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">เลขที่บัญชี</label>
              <input
                type="text"
                value={accountNo}
                onChange={e => setAccountNo(e.target.value.replace(/\D/g, '').slice(0, 15))}
                placeholder="1234567890"
                className="input-premium font-mono tracking-wider"
              />
            </div>
          </div>
        )}

        {/* Amount */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">จำนวนเงิน</label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none group">
              <div className={`w-8 h-4 rounded-full transition-all relative ${anyAmount ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                onClick={() => { setAnyAmount(v => !v); if (!anyAmount) setAmount('') }}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all ${anyAmount ? 'left-4' : 'left-0.5'}`} />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">ระบบอัตโนมัติ</span>
            </label>
          </div>
          <div className="relative">
            <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-sm transition-colors ${anyAmount ? 'text-gray-300 dark:text-gray-600' : 'text-gray-500 dark:text-gray-400'}`}>฿</span>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              disabled={anyAmount}
              placeholder={anyAmount ? 'รับอัตโนมัติจากบอท' : '0.00'}
              min="0" step="0.01"
              className={`input-premium pl-9 font-mono ${anyAmount ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
        </div>


        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 px-4 py-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl">
            <svg className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-rose-700 dark:text-rose-400 text-sm">{error}</p>
          </div>
        )}

        {/* Generate button */}
        <button onClick={handleGenerate} disabled={loading} className="btn-primary w-full text-sm">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              กำลังสร้าง QR Code...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              สร้าง QR Code อัตโนมัติ
            </span>
          )}
        </button>
      </div>

      {/* ── QR / Dashboard ── */}
      <div className={`flex flex-col rounded-2xl min-h-[360px] transition-all ${
        !qrDataUrl
          ? 'bg-gray-50/80 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 p-4'
          : 'bg-gradient-to-b from-indigo-50 to-violet-50 dark:from-indigo-500/5 dark:to-violet-500/5 border border-indigo-100 dark:border-indigo-500/10 items-center justify-center p-6'
      }`}>
        {!qrDataUrl ? (
          <DashboardStats />
        ) : (
          <div className="text-center space-y-4 animate-scale-in">
            {/* QR with glow */}
            <div className="relative inline-block">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-400/20 to-violet-400/20 blur-xl scale-110" />
              <div className="relative bg-white rounded-2xl p-3 shadow-xl shadow-indigo-500/10">
                <img src={qrDataUrl} alt="QR Code" className="w-52 h-52 rounded-xl" />
              </div>
            </div>

            {!anyAmount && amount && parseFloat(amount) > 0 && (
              <div>
                <p className="text-2xl font-bold gradient-text font-num">
                  ฿{parseFloat(amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
            {anyAmount && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                ระบบอัตโนมัติ
              </span>
            )}
            <p className="text-[10px] text-gray-400 font-mono">ID: {result?.id?.slice(0, 8)}…</p>
            <div className="flex items-center gap-2 justify-center">
              <button onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/15 transition-all shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                บันทึกรูป
              </button>
              <button onClick={() => { setQrDataUrl(''); setResult(null) }}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/15 transition-all shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                สร้างใหม่
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
