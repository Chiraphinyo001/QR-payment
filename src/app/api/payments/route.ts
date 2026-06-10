import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  // ตรวจสอบ session
  const supabaseServer = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabaseServer.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = user.id

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '10')
  const from = (page - 1) * limit
  const to = from + limit - 1

  // ดึงเฉพาะ QR ของ user นี้
  const { data, error, count } = await supabaseAdmin
    .from('qr_payments')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count, page, limit })
}

export async function DELETE(req: NextRequest) {
  // ตรวจสอบ session
  const supabaseServer = createSupabaseServerClient()
  const {
    data: { session },
  } = await supabaseServer.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // ลบด้วย id เพียงอย่างเดียว (admin client bypass RLS)
  // รองรับทั้ง record ที่มี user_id และ record เก่าที่ user_id = NULL
  const { error } = await supabaseAdmin
    .from('qr_payments')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest) {
  const supabaseServer = createSupabaseServerClient()
  const { data: { session } } = await supabaseServer.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  try {
    const body = await req.json()
    
    // Only allow updating certain fields
    const updateData: any = {}
    if (typeof body.notify_success === 'boolean') updateData.notify_success = body.notify_success
    if (typeof body.notify_fail === 'boolean') updateData.notify_fail = body.notify_fail
    if (typeof body.is_paused === 'boolean') updateData.is_paused = body.is_paused
    if (body.schedule_type !== undefined) updateData.schedule_type = body.schedule_type
    if (body.schedule_time !== undefined) updateData.schedule_time = body.schedule_time

    const { error } = await supabaseAdmin
      .from('qr_payments')
      .update(updateData)
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
