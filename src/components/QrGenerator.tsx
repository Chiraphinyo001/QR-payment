'use client'

import { useState, useRef, useCallback } from 'react'
import QRCode from 'qrcode'
import type { GenerateRequest, GenerateResponse } from '@/app/api/generate/route'

const BANKS = [
  { code: '014', name: 'KTB - กรุงไทย' },
  { code: '004', name: 'KBANK - กสิกรไทย' },
  { code: '002', name: 'BBL - กรุงเทพ' },
  { code: '025', name: 'BAY - กรุงศรีอยุธยา' },
  { code: '030', name: 'SCB - ไทยพาณิชย์' },
  { code: '011', name: 'TMBThanachart - ทหารไทยธนชาต' },
  { code: '022', name: 'CIMB - ซีไอเอ็มบี' },
  { code: '067', name: 'TISCO - ทิสโก้' },
  { code: '024', name: 'UOB - ยูโอบี' },
  { code: '069', name: 'KKP - เกียรตินาคินภัทร' },
]

const QUICK_AMOUNTS = [20, 50, 100, 200, 500, 1000, 2000, 5000]

type Tab = 'phone' | 'national_id' | 'bank_account'

export default function QrGenerator({ onGenerated }: { onGenerated?: () => void }) {
  const [tab, setTab] = useState<Tab>('phone')
  const [phone, setPhone] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [bankCode, setBankCode] = useState('')
  const [accountNo, setAccountNo] = useState('')
  const [amount, setAmount] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [result, setResult] = useState<GenerateResponse | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleGenerate = useCallback(async () => {
    setError('')
    setLoading(true)

    const payload: GenerateRequest = {
      proxyType: tab,
      proxyValue: tab === 'phone' ? phone : tab === 'national_id' ? nationalId : accountNo,
      bankCode: tab === 'bank_account' ? bankCode : undefined,
      bankName: tab === 'bank_account' ? BANKS.find(b => b.code === bankCode)?.name : undefined,
      amount: amount ? parseFloat(amount) : undefined,
      recipientName: recipientName || undefined,
    }

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')

      // Generate QR image from payload
      const dataUrl = await QRCode.toDataURL(data.qrPayload, {
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#111111', light: '#ffffff' },
      })
      setQrDataUrl(dataUrl)
      setResult(data)
      onGenerated?.()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [tab, phone, nationalId, bankCode, accountNo, amount, recipientName, onGenerated])

  const handleDownload = () => {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `promptpay-qr-${result?.id?.slice(0, 8) ?? 'code'}.png`
    a.click()
  }

  const formatIdCard = (val: string) => {
    const d = val.replace(/\D/g, '').slice(0, 13)
    let out = ''
    for (let i = 0; i < d.length; i++) {
      if (i === 1 || i === 5 || i === 10 || i === 12) out += '-'
      out += d[i]
    }
    return out
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'phone', label: 'เบอร์โทร' },
    { id: 'bank_account', label: 'เลขบัญชี' },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form Panel */}
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(''); setQrDataUrl(''); setResult(null) }}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-150 ${
                tab === t.id
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Proxy Input */}
        {tab === 'phone' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">หมายเลขโทรศัพท์</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="0812345678"
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
        )}

        {tab === 'national_id' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">เลขประจำตัวประชาชน</label>
            <input
              type="text"
              value={nationalId}
              onChange={e => setNationalId(formatIdCard(e.target.value))}
              placeholder="3-1234-56789-01-2"
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
        )}

        {tab === 'bank_account' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">ธนาคาร</label>
              <select
                value={bankCode}
                onChange={e => setBankCode(e.target.value)}
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- เลือกธนาคาร --</option>
                {BANKS.map(b => (
                  <option key={b.code} value={b.code}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">เลขที่บัญชี</label>
              <input
                type="text"
                value={accountNo}
                onChange={e => setAccountNo(e.target.value.replace(/\D/g, '').slice(0, 15))}
                placeholder="1234567890"
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          </div>
        )}

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            จำนวนเงิน <span className="text-gray-400 dark:text-gray-500 font-normal">(ไม่ระบุ = รับทุกจำนวน)</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">฿</span>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full pl-8 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
        </div>

        {/* Recipient Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">ชื่อผู้รับเงิน (ไม่บังคับ)</label>
          <input
            type="text"
            value={recipientName}
            onChange={e => setRecipientName(e.target.value)}
            placeholder="เช่น ร้านกาแฟน้องหมู"
            className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 
                     dark:from-blue-500 dark:to-indigo-600 dark:hover:from-blue-600 dark:hover:to-indigo-700
                     disabled:from-blue-400 disabled:to-indigo-400 dark:disabled:from-gray-700 dark:disabled:to-gray-800
                     text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 dark:shadow-blue-900/40
                     transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2.5"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              กำลังสร้าง QR Code...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              สร้าง QR Code อัตโนมัติ
            </>
          )}
        </button>
      </div>

      {/* QR Display Panel */}
      <div className="flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-6 min-h-[360px] transition-colors">
        {!qrDataUrl ? (
          <div className="text-center text-gray-400 dark:text-gray-500">
            <div className="w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-10 h-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <p className="text-sm">กรอกข้อมูลแล้วกด "สร้าง QR Code อัตโนมัติ"</p>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <img src={qrDataUrl} alt="QR Code" className="w-52 h-52 mx-auto rounded-xl shadow-sm" />
            {recipientName && (
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{recipientName}</p>
            )}
            {amount && parseFloat(amount) > 0 && (
              <p className="text-2xl font-bold text-gray-900 dark:text-white font-mono">
                ฿{parseFloat(amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </p>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500">ID: {result?.id?.slice(0, 8)}…</p>
            <button
              onClick={handleDownload}
              className="px-5 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 mx-auto"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              บันทึกรูป
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
