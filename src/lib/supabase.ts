import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client สำหรับ Browser
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Client สำหรับ Server (API Routes) — bypass RLS
export const supabaseAdmin =
  typeof window === 'undefined'
    ? createClient<Database>(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    : (null as any)
