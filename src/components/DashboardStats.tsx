'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createBrowserClient } from '@supabase/ssr'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

export default function DashboardStats() {
  const [stats, setStats] = useState({
    activeAccounts: 0,
    qrToday: 0,
    amountToday: 0,
    amountWeek: 0,
    amountMonth: 0,
    amountYear: 0,
  })
  
  const [qrLast7Days, setQrLast7Days] = useState<number[]>([0,0,0,0,0,0,0])
  const [amountMonthly, setAmountMonthly] = useState<number[]>(Array(12).fill(0))
  const [accountTypes, setAccountTypes] = useState({ phone: 0, bank: 0, id: 0 })
  const [loading, setLoading] = useState(true)
  const [isFullScreen, setIsFullScreen] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 6)
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const thisYear = new Date(now.getFullYear(), 0, 1)

      // Fetch Qr payments
      const { data: payments } = await supabase
        .from('qr_payments')
        .select('*')
        .eq('user_id', user.id)

      if (payments) {
        const paymentIds = payments.map(p => p.id)
        let transactions: any[] = []
        
        if (paymentIds.length > 0) {
          // Fetch Transactions
          const { data: txs } = await supabase
            .from('qr_transactions')
            .select('*')
            .in('payment_id', paymentIds)
            .eq('status', 'success')
            
          transactions = txs || []
        }

        // Calculate Stats
        const activeAccounts = payments.filter(p => !p.is_paused).length
        const qrToday = payments.filter(p => new Date(p.created_at) >= today).length
        
        const amountToday = transactions.filter(t => new Date(t.created_at) >= today).reduce((sum, t) => sum + Number(t.amount), 0)
        const amountWeek = transactions.filter(t => new Date(t.created_at) >= weekAgo).reduce((sum, t) => sum + Number(t.amount), 0)
        const amountMonth = transactions.filter(t => new Date(t.created_at) >= thisMonth).reduce((sum, t) => sum + Number(t.amount), 0)
        const amountYear = transactions.filter(t => new Date(t.created_at) >= thisYear).reduce((sum, t) => sum + Number(t.amount), 0)

        setStats({ activeAccounts, qrToday, amountToday, amountWeek, amountMonth, amountYear })

        // Chart Data: QR Last 7 Days
        const qr7Days = [0, 0, 0, 0, 0, 0, 0]
        payments.forEach(p => {
          const d = new Date(p.created_at)
          if (d >= weekAgo) {
            const diffDays = Math.floor((d.getTime() - weekAgo.getTime()) / (1000 * 3600 * 24))
            if (diffDays >= 0 && diffDays < 7) {
              qr7Days[diffDays]++
            }
          }
        })
        setQrLast7Days(qr7Days)

        // Chart Data: Monthly Amount Current Year
        const monthly = Array(12).fill(0)
        transactions.forEach(t => {
          const d = new Date(t.created_at)
          if (d.getFullYear() === now.getFullYear()) {
            monthly[d.getMonth()] += Number(t.amount)
          }
        })
        setAmountMonthly(monthly)

        // Chart Data: Account Types
        let phone = 0, bank = 0, id = 0
        payments.forEach(p => {
          if (p.proxy_type === 'phone') phone++
          else if (p.proxy_type === 'bank_account') bank++
          else id++
        })
        setAccountTypes({ phone, bank, id })
      }
      
      setLoading(false)
    }

    fetchData()
  }, [])

  // Labels
  const last7DaysLabels = Array.from({length: 7}).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })
  })
  
  const monthLabels = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[360px] text-gray-500">
        <svg className="animate-spin h-8 w-8 mb-4 text-indigo-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <p className="text-sm animate-pulse">กำลังโหลดข้อมูลสถิติ...</p>
      </div>
    )
  }

  const content = (
    <div className="w-full space-y-6 animate-fade-in pb-4">
      {/* Header with Expand Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">ภาพรวมสถิติ</h3>
        <button 
          onClick={() => setIsFullScreen(!isFullScreen)} 
          className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title={isFullScreen ? "ย่อหน้าต่าง" : "ขยายเต็มจอ"}
        >
          {isFullScreen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )}
        </button>
      </div>

      {/* 6 Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard title="บัญชีที่เปิดใช้งาน" value={stats.activeAccounts} unit="บัญชี" icon="📊" />
        <StatCard title="QR สร้างวันนี้" value={stats.qrToday} unit="รายการ" icon="✨" color="text-indigo-600 dark:text-indigo-400" />
        <StatCard title="ยอดรวมวันนี้" value={stats.amountToday.toLocaleString('th-TH', { minimumFractionDigits: 2 })} unit="บาท" icon="💰" color="text-emerald-600 dark:text-emerald-400" />
        <StatCard title="ยอดรวม 7 วันล่าสุด" value={stats.amountWeek.toLocaleString('th-TH', { minimumFractionDigits: 2 })} unit="บาท" icon="📈" color="text-blue-600 dark:text-blue-400" />
        <StatCard title="ยอดรวมเดือนนี้" value={stats.amountMonth.toLocaleString('th-TH', { minimumFractionDigits: 2 })} unit="บาท" icon="📅" color="text-amber-600 dark:text-amber-400" />
        <StatCard title="ยอดรวมปีนี้" value={stats.amountYear.toLocaleString('th-TH', { minimumFractionDigits: 2 })} unit="บาท" icon="🏆" color="text-purple-600 dark:text-purple-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bar Chart */}
        <div className="bg-white dark:bg-[#1A1F2C] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800/60">
          <h4 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">จำนวน QR Code 7 วันล่าสุด</h4>
          <div className="h-44">
            <Bar 
              data={{
                labels: last7DaysLabels,
                datasets: [{
                  label: 'QR Code',
                  data: qrLast7Days,
                  backgroundColor: '#6366f1',
                  borderRadius: 4,
                  barThickness: 16
                }]
              }}
              options={{ 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                  y: { border: { display: false }, ticks: { font: { size: 10 }, precision: 0 } }
                }
              }}
            />
          </div>
        </div>

        {/* Doughnut Chart */}
        <div className="bg-white dark:bg-[#1A1F2C] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800/60">
          <h4 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">สัดส่วนประเภทบัญชี</h4>
          <div className="h-44 flex items-center justify-center relative">
            <div className="w-[50%] h-full">
              <Doughnut 
                data={{
                  labels: ['เบอร์โทรศัพท์', 'เลขบัญชีธนาคาร', 'บัตรประชาชน'],
                  datasets: [{
                    data: [accountTypes.phone, accountTypes.bank, accountTypes.id],
                    backgroundColor: ['#3b82f6', '#f59e0b', '#8b5cf6'],
                    borderWidth: 0,
                    hoverOffset: 4
                  }]
                }}
                options={{
                  maintainAspectRatio: false,
                  cutout: '75%',
                  plugins: { legend: { display: false } }
                }}
              />
            </div>
            {/* Custom Legend */}
            <div className="w-[50%] pl-4 flex flex-col justify-center space-y-3">
              <LegendItem color="bg-blue-500" label="เบอร์โทร" value={accountTypes.phone} />
              <LegendItem color="bg-amber-500" label="เลขบัญชี" value={accountTypes.bank} />
              <LegendItem color="bg-purple-500" label="บัตร ปชช." value={accountTypes.id} />
            </div>
          </div>
        </div>
        
        {/* Line Chart (Full Width) */}
        <div className="bg-white dark:bg-[#1A1F2C] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800/60 md:col-span-2">
          <h4 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">ยอดเงิน (บาท) รายเดือน ปีปัจจุบัน</h4>
          <div className="h-48">
            <Line 
              data={{
                labels: monthLabels,
                datasets: [{
                  label: 'ยอดเงิน (บาท)',
                  data: amountMonthly,
                  borderColor: '#10b981',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  tension: 0.4,
                  fill: true,
                  pointRadius: 3,
                  pointHoverRadius: 6,
                  borderWidth: 2
                }]
              }}
              options={{ 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                  y: { border: { display: false }, ticks: { font: { size: 10 } } }
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )

  if (isFullScreen && typeof window !== 'undefined') {
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-slate-50 dark:bg-[#121621] p-6 md:p-10 overflow-y-auto">
        <div className="max-w-6xl mx-auto w-full">
          {content}
        </div>
      </div>,
      document.body
    )
  }

  return content
}

function StatCard({ title, value, unit, icon, color = "text-gray-900 dark:text-white" }: { title: string, value: string | number, unit: string, icon: string, color?: string }) {
  return (
    <div className="bg-white dark:bg-[#1A1F2C] rounded-xl p-3.5 shadow-sm border border-gray-100 dark:border-gray-800/60 flex flex-col justify-between">
      <div className="flex items-center gap-1.5 mb-2 text-gray-500 dark:text-gray-400">
        <span className="text-sm">{icon}</span>
        <h4 className="text-[10px] uppercase tracking-wide font-semibold">{title}</h4>
      </div>
      <div className="flex items-baseline gap-1 mt-auto">
        <span className={`text-lg font-bold font-mono truncate ${color}`}>{value}</span>
        <span className="text-[9px] text-gray-400 font-medium">{unit}</span>
      </div>
    </div>
  )
}

function LegendItem({ color, label, value }: { color: string, label: string, value: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{label}</span>
      </div>
      <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 font-mono">{value}</span>
    </div>
  )
}
