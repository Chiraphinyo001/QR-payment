import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── LINE Notify ──────────────────────────────────────────────────
async function sendLineNotify(token: string, message: string) {
  try {
    await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ message }),
    })
  } catch (e) {
    console.error('LINE Notify error:', e)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { transaction_id, payment_id, slip_url, amount } = body

    if (!(transaction_id || payment_id) || !slip_url) {
      return NextResponse.json(
        { error: 'Missing transaction_id (or payment_id) or slip_url' },
        { status: 400 }
      )
    }

    // ── 1. ตรวจสลิปซ้ำ (Duplicate Detection) ───────────────────
    const { data: dupTx } = await supabase
      .from('qr_transactions' as any)
      .select('id, payment_id, amount, created_at')
      .eq('slip_url', slip_url)
      .eq('is_verified_slip', true)
      .maybeSingle() as any

    if (dupTx) {
      // ถ้าเป็น transaction เดิมให้ข้ามไป แต่ถ้าเป็นอันอื่นให้บล็อก
      const isSameTx = transaction_id && dupTx.id === transaction_id
      if (!isSameTx) {
        // อัปเดตสถานะของ transaction นี้ให้ล้มเหลว
        if (transaction_id) {
          await (supabase.from('qr_transactions' as any) as any)
            .update({
              status: 'failed',
              is_verified_slip: false,
              error_message: 'สลิปซ้ำ — เคยใช้ยืนยันแล้วเมื่อ ' +
                new Date(dupTx.created_at).toLocaleString('th-TH'),
            })
            .eq('id', transaction_id)
        }
        return NextResponse.json({
          success: false,
          is_valid: false,
          is_duplicate: true,
          message: 'สลิปซ้ำ — สลิปนี้เคยใช้ยืนยันการชำระเงินแล้ว',
        })
      }
    }

    // ── 2. ดึงข้อมูล payment config และ user ──────────────────
    let paymentConfig: any = null
    let txPaymentId = payment_id

    if (transaction_id) {
      const { data: tx } = await (supabase.from('qr_transactions' as any) as any)
        .select('payment_id, amount')
        .eq('id', transaction_id)
        .single() as any
      if (tx) txPaymentId = tx.payment_id
    }

    if (txPaymentId) {
      const { data } = await supabase
        .from('qr_payments')
        .select('id, user_id, line_notify_token, expires_at, is_paused, proxy_value, proxy_type')
        .eq('id', txPaymentId)
        .single() as any
      paymentConfig = data
    }

    // ── 3. ตรวจ QR หมดอายุ ────────────────────────────────────
    if (paymentConfig?.expires_at) {
      const expiresAt = new Date(paymentConfig.expires_at)
      if (new Date() > expiresAt) {
        if (transaction_id) {
          await (supabase.from('qr_transactions' as any) as any)
            .update({
              status: 'failed',
              is_verified_slip: false,
              error_message: 'QR Code หมดอายุแล้ว',
            })
            .eq('id', transaction_id)
        }
        return NextResponse.json({
          success: false,
          is_valid: false,
          is_expired: true,
          message: 'QR Code หมดอายุแล้ว',
        })
      }
    }

    // ── 4. ตรวจ Blacklist ────────────────────────────────────
    // ดึง slip_data เพื่อหาข้อมูลผู้โอน (ถ้ามี)
    let senderInfo: string | null = null
    if (transaction_id) {
      const { data: txData } = await (supabase.from('qr_transactions' as any) as any)
        .select('slip_data')
        .eq('id', transaction_id)
        .single() as any
      senderInfo = txData?.slip_data?.senderName || txData?.slip_data?.senderAccount || null
    }

    if (senderInfo && paymentConfig?.user_id) {
      const { data: blacklisted } = await supabase
        .from('slip_blacklist')
        .select('id, reason')
        .eq('user_id', paymentConfig.user_id)
        .eq('identifier', senderInfo)
        .maybeSingle() as any

      if (blacklisted) {
        if (transaction_id) {
          await (supabase.from('qr_transactions' as any) as any)
            .update({
              status: 'failed',
              is_verified_slip: false,
              error_message: `บัญชีถูก Blacklist: ${blacklisted.reason || 'ไม่ระบุเหตุผล'}`,
            })
            .eq('id', transaction_id)
        }

        // แจ้ง LINE ถ้ามี token
        if (paymentConfig?.line_notify_token) {
          await sendLineNotify(
            paymentConfig.line_notify_token,
            `\n🚫 ตรวจพบบัญชี Blacklist!\n` +
            `ผู้โอน: ${senderInfo}\n` +
            `เหตุผล: ${blacklisted.reason || 'ไม่ระบุ'}`
          )
        }

        return NextResponse.json({
          success: false,
          is_valid: false,
          is_blacklisted: true,
          message: `บัญชีผู้โอนถูก Blacklist`,
        })
      }
    }

    // ── 5. ตรวจสลิปจริง ──────────────────────────────────────
    let isValidSlip = false
    let mockSlipData: any = null
    const SLIP_VERIFY_API_KEY = process.env.SLIP_VERIFY_API_KEY

    if (SLIP_VERIFY_API_KEY && !slip_url.includes('fake')) {
      // TODO: เชื่อม EasySlip / SlipOK จริง
      // const response = await fetch('https://api.easyslip.com/v1/verify', { ... })
      isValidSlip = true
      mockSlipData = {
        transRef: 'REF_' + Math.floor(Math.random() * 1000000),
        senderName: 'ลูกค้า',
        amount: amount || 100,
        timestamp: new Date().toISOString(),
      }
    } else {
      const isFake = slip_url.includes('fake')
      isValidSlip = !isFake
      mockSlipData = {
        transRef: 'MOCK_' + Math.floor(Math.random() * 1000000),
        senderName: 'นาย ทดสอบ',
        amount: amount || 100,
        timestamp: new Date().toISOString(),
      }
    }

    // ── 6. อัปเดต Database ───────────────────────────────────
    let txId = transaction_id

    if (transaction_id) {
      const { error } = await (supabase.from('qr_transactions' as any) as any)
        .update({
          status: isValidSlip ? 'success' : 'failed',
          error_message: isValidSlip ? null : 'สลิปปลอมหรือตรวจสอบไม่ผ่าน',
          slip_url,
          is_verified_slip: isValidSlip,
          slip_data: mockSlipData,
        })
        .eq('id', transaction_id)
      if (error) throw error
    } else if (payment_id) {
      const { data: newTx, error } = await (supabase.from('qr_transactions' as any) as any)
        .insert({
          payment_id,
          amount: Number(amount || mockSlipData.amount),
          status: isValidSlip ? 'success' : 'failed',
          error_message: isValidSlip ? null : 'สลิปปลอมหรือตรวจสอบไม่ผ่าน',
          slip_url,
          is_verified_slip: isValidSlip,
          slip_data: mockSlipData,
        })
        .select()
        .single()
      if (error) throw error
      txId = (newTx as any).id
    }

    // ── 7. LINE Notify ─────────────────────────────────────
    if (paymentConfig?.line_notify_token) {
      const amountDisplay = mockSlipData?.amount
        ? `฿${Number(mockSlipData.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`
        : '-'
      const statusIcon = isValidSlip ? '✅' : '❌'
      const statusText = isValidSlip ? 'สลิปจริง — ชำระเงินสำเร็จ' : 'สลิปปลอม — ชำระเงินไม่สำเร็จ'

      await sendLineNotify(
        paymentConfig.line_notify_token,
        `\n${statusIcon} ${statusText}\n` +
        `ยอดเงิน: ${amountDisplay}\n` +
        `ผู้โอน: ${mockSlipData?.senderName || '-'}\n` +
        `เวลา: ${new Date().toLocaleString('th-TH')}`
      )
    }

    return NextResponse.json({
      success: true,
      transaction_id: txId,
      is_valid: isValidSlip,
      message: isValidSlip ? 'ตรวจสอบสลิปผ่าน' : 'สลิปปลอมหรือข้อมูลไม่ถูกต้อง',
      slip_data: mockSlipData,
    })
  } catch (error: any) {
    console.error('Error verifying slip:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
