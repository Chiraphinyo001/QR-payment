-- =============================================
-- QR Payment Generator - Supabase Schema
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- Table: qr_payments
-- เก็บประวัติ QR Code ที่สร้าง
-- =============================================
create table if not exists public.qr_payments (
  id            uuid primary key default uuid_generate_v4(),
  proxy_type    text not null check (proxy_type in ('phone', 'national_id', 'bank_account')),
  proxy_value   text not null,           -- เบอร์โทร / เลข ปชช / เลขบัญชี
  bank_code     text,                    -- รหัสธนาคาร (ถ้าเป็น bank_account)
  bank_name     text,                    -- ชื่อธนาคาร
  amount        numeric(15,2),           -- จำนวนเงิน (null = รับทุกจำนวน)
  recipient_name text,                   -- ชื่อผู้รับเงิน (optional)
  qr_payload    text not null,           -- EMV QR payload string
  scan_count    integer default 0,       -- จำนวนครั้งที่สแกน (ถ้าต้องการ tracking)
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  -- Optional: เชื่อมกับ user (ถ้า login)
  user_id       uuid references auth.users(id) on delete set null
);

-- =============================================
-- Table: qr_scan_logs
-- บันทึกการสแกน (optional tracking)
-- =============================================
create table if not exists public.qr_scan_logs (
  id            uuid primary key default uuid_generate_v4(),
  payment_id    uuid references public.qr_payments(id) on delete cascade,
  scanned_at    timestamptz default now(),
  user_agent    text,
  ip_address    inet
);

-- =============================================
-- Indexes
-- =============================================
create index if not exists idx_qr_payments_proxy      on public.qr_payments(proxy_value);
create index if not exists idx_qr_payments_user       on public.qr_payments(user_id);
create index if not exists idx_qr_payments_created    on public.qr_payments(created_at desc);
create index if not exists idx_qr_scan_logs_payment   on public.qr_scan_logs(payment_id);

-- =============================================
-- Row Level Security (RLS)
-- =============================================
alter table public.qr_payments  enable row level security;
alter table public.qr_scan_logs enable row level security;

-- Policy: ทุกคนดูได้ถ้า user_id เป็น null (public QR)
create policy "Public QRs are viewable by anyone"
  on public.qr_payments for select
  using (user_id is null);

-- Policy: เจ้าของดู QR ของตัวเองได้
create policy "Users can view own QRs"
  on public.qr_payments for select
  using (auth.uid() = user_id);

-- Policy: ทุกคน insert ได้ (anonymous หรือ logged-in)
create policy "Anyone can create QR"
  on public.qr_payments for insert
  with check (true);

-- Policy: เจ้าของแก้ไข/ลบได้
create policy "Users can update own QRs"
  on public.qr_payments for update
  using (auth.uid() = user_id);

create policy "Users can delete own QRs"
  on public.qr_payments for delete
  using (auth.uid() = user_id);

-- Scan logs: insert ได้เสมอ
create policy "Anyone can log scans"
  on public.qr_scan_logs for insert
  with check (true);

-- =============================================
-- Function: auto-update updated_at
-- =============================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_qr_payments_updated
  before update on public.qr_payments
  for each row execute function public.handle_updated_at();

-- =============================================
-- Function: increment scan count
-- =============================================
create or replace function public.increment_scan_count(payment_id uuid)
returns void as $$
begin
  update public.qr_payments
  set scan_count = scan_count + 1
  where id = payment_id;
end;
$$ language plpgsql security definer;
