import { NextRequest, NextResponse } from 'next/server'
import { buildPromptPayPayload, validateProxy } from '@/lib/promptpay'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { ProxyType } from '@/lib/database.types'

export interface GenerateRequest {
  proxyType: ProxyType
  proxyValue: string
  bankCode?: string
  bankName?: string
  amount?: number
  recipientName?: string
}

export interface GenerateResponse {
  id: string
  qrPayload: string
  createdAt: string
}

export async function POST(req: NextRequest) {
  try {
    // ดึง session จาก cookie
    const supabaseServer = createSupabaseServerClient()
    const {
      data: { user },
    } = await supabaseServer.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = user.id

    const body: GenerateRequest = await req.json()
    const { proxyType, proxyValue, bankCode, bankName, amount, recipientName } = body

    // Validate
    const proxyForValidation =
      proxyType === 'bank_account' ? proxyValue.replace(/\D/g, '') : proxyValue
    const err = validateProxy(proxyType, proxyForValidation)
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 })
    }

    // Build QR payload
    const rawProxy =
      proxyType === 'bank_account' && bankCode
        ? bankCode + proxyValue.replace(/\D/g, '')
        : proxyValue.replace(/\D/g, '')

    const qrPayload = buildPromptPayPayload({
      proxyType,
      proxyValue: rawProxy,
      amount: amount && amount > 0 ? amount : undefined,
    })

    // Save to Supabase (ใช้ admin เพื่อ bypass RLS แต่ใส่ user_id ด้วย)
    const { data, error } = await supabaseAdmin
      .from('qr_payments')
      .insert({
        proxy_type: proxyType,
        proxy_value: proxyValue.replace(/\D/g, ''),
        bank_code: bankCode ?? null,
        bank_name: bankName ?? null,
        amount: amount && amount > 0 ? amount : null,
        recipient_name: recipientName?.trim() || null,
        qr_payload: qrPayload,
        user_id: userId,
      })
      .select('id, created_at')
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json({ error: 'บันทึกข้อมูลล้มเหลว' }, { status: 500 })
    }

    return NextResponse.json({
      id: data.id,
      qrPayload,
      createdAt: data.created_at,
    } satisfies GenerateResponse)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
