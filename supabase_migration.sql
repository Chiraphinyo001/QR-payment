-- รันคำสั่งนี้ใน SQL Editor ของ Supabase เพื่ออัปเดตตารางให้รองรับระบบสลิปและบอท

-- 1. เพิ่มคอลัมน์ order_id ในตาราง qr_payments (ใช้เก็บอ้างอิง Order จาก Bot)
ALTER TABLE qr_payments 
ADD COLUMN IF NOT EXISTS order_id text;

-- 2. เพิ่มคอลัมน์สำหรับตรวจสอบสลิปในตาราง qr_transactions
ALTER TABLE qr_transactions 
ADD COLUMN IF NOT EXISTS slip_url text,
ADD COLUMN IF NOT EXISTS is_verified_slip boolean,
ADD COLUMN IF NOT EXISTS slip_data jsonb;
