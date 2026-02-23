import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from './supabase'

export async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function requireAuth() {
  const user = await getUser()
  if (!user) redirect('/login')
  return user
}

export async function getUserOrgRole(userId: string) {
  const orgId = process.env.ADSINC_ORG_ID!
  const { data } = await supabaseAdmin
    .from('org_members')
    .select('role, display_name')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .single()
  return data
}

export async function requireAdmin() {
  const user = await requireAuth()
  const member = await getUserOrgRole(user.id)
  if (!member || !['owner', 'admin'].includes(member.role)) {
    redirect('/')
  }
  return { user, member }
}
