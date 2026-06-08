# QR Pay — PromptPay Generator

สร้าง QR Code ชำระเงินพร้อมเพย์ มาตรฐาน EMV รองรับทุกธนาคารในไทย
พร้อมระบบหลังบ้าน Supabase บันทึกประวัติ

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL + RLS + Realtime)
- **QR Generator**: `qrcode` (EMV PromptPay standard)

---

## โครงสร้างไฟล์

```
qr-payment/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── generate/route.ts     ← POST: สร้าง QR + บันทึก Supabase
│   │   │   └── payments/route.ts     ← GET/DELETE: ดึง/ลบประวัติ
│   │   ├── page.tsx                  ← หน้าหลัก
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── QrGenerator.tsx           ← ฟอร์มสร้าง QR Code
│   │   └── PaymentHistory.tsx        ← ตารางประวัติ + Real-time
│   └── lib/
│       ├── supabase.ts               ← Supabase client
│       ├── database.types.ts         ← TypeScript types
│       └── promptpay.ts              ← EMV QR payload builder
├── supabase/
│   └── migrations/
│       └── 001_init.sql              ← Schema + RLS policies
├── .env.local.example
└── package.json
```

---

## วิธีติดตั้ง

### 1. Clone & Install

```bash
git clone <your-repo>
cd qr-payment
npm install
```

### 2. ตั้งค่า Supabase

1. สร้างโปรเจกต์ใหม่ที่ [supabase.com](https://supabase.com)
2. ไปที่ **SQL Editor** แล้วรัน migration:
   ```sql
   -- copy เนื้อหาจาก supabase/migrations/001_init.sql แล้ว run
   ```
3. Copy ค่าจาก **Settings → API**:
   - `Project URL`
   - `anon / public` key
   - `service_role` key (สำหรับ API routes)

### 3. ตั้งค่า Environment

```bash
cp .env.local.example .env.local
```

แก้ไข `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### 4. รัน Development Server

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

---

## API Endpoints

### `POST /api/generate`
สร้าง QR Code ใหม่และบันทึกลง Supabase

**Body:**
```json
{
  "proxyType": "phone",          // "phone" | "national_id" | "bank_account"
  "proxyValue": "0812345678",
  "amount": 100.00,              // optional
  "recipientName": "ร้านกาแฟ",  // optional
  "bankCode": "030",             // required ถ้า bank_account
  "bankName": "SCB"              // required ถ้า bank_account
}
```

**Response:**
```json
{
  "id": "uuid",
  "qrPayload": "00020101...",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### `GET /api/payments?page=1&limit=10`
ดึงประวัติ QR Code ทั้งหมด (pagination)

### `DELETE /api/payments?id=<uuid>`
ลบ QR Code

---

## Supabase Features ที่ใช้

| Feature | การใช้งาน |
|---------|-----------|
| **PostgreSQL** | เก็บประวัติ QR Code และ scan logs |
| **Row Level Security** | ควบคุมสิทธิ์ read/write ต่อ user |
| **Realtime** | อัปเดตประวัติอัตโนมัติเมื่อมี QR ใหม่ |
| **Service Role** | API routes bypass RLS สำหรับ admin |

---

## Deploy บน Vercel

```bash
npm run build   # ทดสอบก่อน deploy
vercel deploy
```

เพิ่ม environment variables ใน Vercel Dashboard เหมือนกับ `.env.local`
