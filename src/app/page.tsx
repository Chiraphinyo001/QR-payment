'use client'

import { useState } from 'react'
import QrGenerator from '@/components/QrGenerator'
import PaymentHistory from '@/components/PaymentHistory'

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate')

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900">QR Pay</h1>
              <p className="text-xs text-gray-400">PromptPay Generator</p>
            </div>
          </div>

          {/* Tab switcher (mobile) */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5 lg:hidden">
            {(['generate', 'history'] as const).map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                {t === 'generate' ? 'สร้าง QR' : 'ประวัติ'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Desktop: show both panels side by side */}
        <div className="hidden lg:block">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <QrGenerator onGenerated={() => setRefreshKey(k => k + 1)} />
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <PaymentHistory refreshKey={refreshKey} />
          </div>
        </div>

        {/* Mobile: tab-based */}
        <div className="lg:hidden">
          {activeTab === 'generate' ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <QrGenerator onGenerated={() => { setRefreshKey(k => k + 1); setActiveTab('history') }} />
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <PaymentHistory refreshKey={refreshKey} />
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
