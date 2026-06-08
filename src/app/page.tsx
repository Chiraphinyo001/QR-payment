import { createSupabaseServerClient } from '@/lib/supabase-server'
import HomeClient from './HomeClient'

export default async function Home() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const userEmail   = user?.email ?? null
  // Google OAuth เก็บ avatar ไว้ใน user_metadata.avatar_url หรือ picture
  const avatarUrl   = (user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture) as string | null

  return <HomeClient userEmail={userEmail} avatarUrl={avatarUrl} />
}
