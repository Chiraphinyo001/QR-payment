import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
// @ts-ignore
import generatePayload from 'promptpay-qr'
import { Database } from '@/lib/database.types'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    // รับ payment_id ซึ่งก็คือ ID ของระบบ QR ในแดชบอร์ด
    const { payment_id, amount, order_id } = body

    if (!payment_id || !amount) {
      return NextResponse.json({ error: 'Missing required fields: payment_id, amount' }, { status: 400 })
    }

    // 1. ดึงข้อมูลระบบ QR จากฐานข้อมูล
    const { data: paymentConfig, error: fetchError } = await supabase
      .from('qr_payments')
      .select('*')
      .eq('id', payment_id)
      .single() as any

    if (fetchError || !paymentConfig) {
      return NextResponse.json({ error: 'System API ID not found' }, { status: 404 })
    }

    if (paymentConfig.is_paused) {
      return NextResponse.json({ error: 'This payment system is paused' }, { status: 400 })
    }

    // 2. สร้าง QR Payload ด้วยข้อมูลจาก Database
    const payload = generatePayload(paymentConfig.proxy_value, { amount: Number(amount) })

    // 3. สร้าง Transaction รอดำเนินการ (Pending)
    const { data: tx, error: txError } = await (supabase.from('qr_transactions') as any)
      .insert({
        payment_id: paymentConfig.id,
        amount: Number(amount),
        status: 'pending',
        slip_data: { order_id: order_id || null }
      } as any)
      .select()
      .single() as any

    if (txError) throw txError

    return NextResponse.json({
      success: true,
      transaction_id: tx.id,
      payment_id: paymentConfig.id,
      qr_payload: payload,
      qr_image_url: `https://promptpay.io/${paymentConfig.proxy_value}/${amount}.png`
    })
  } catch (error: any) {
    console.error('Error generating QR:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
