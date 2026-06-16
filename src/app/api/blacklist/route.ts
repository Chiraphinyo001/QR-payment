import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── GET: ดึง blacklist ของ user ──────────────────────────────────
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('user_id')
    if (!userId) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    const { data, error } = await supabase
      .from('slip_blacklist')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── POST: เพิ่ม blacklist ──────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { user_id, identifier, identifier_type = 'auto', reason } = body

    if (!user_id || !identifier) {
      return NextResponse.json({ error: 'Missing user_id or identifier' }, { status: 400 })
    }

    // ตรวจว่ามีอยู่แล้วไหม
    const { data: existing } = await supabase
      .from('slip_blacklist')
      .select('id')
      .eq('user_id', user_id)
      .eq('identifier', identifier)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'มีอยู่ใน Blacklist แล้ว' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('slip_blacklist')
      .insert({ user_id, identifier, identifier_type, reason: reason || null })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── DELETE: ลบรายการ blacklist ─────────────────────────────────
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { error } = await supabase
      .from('slip_blacklist')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
