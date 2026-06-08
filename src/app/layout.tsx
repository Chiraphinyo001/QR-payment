import type { Metadata } from 'next'
import { Sarabun } from 'next/font/google'
import './globals.css'

const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-sarabun',
})

export const metadata: Metadata = {
  title: 'QR Pay — PromptPay Generator',
  description: 'สร้าง QR Code ชำระเงินพร้อมเพย์ รองรับทุกธนาคารในไทย',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={`${sarabun.variable} font-sans antialiased`}>{children}</body>
    </html>
  )
}
