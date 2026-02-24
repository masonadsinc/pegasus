import { NextResponse } from 'next/server'
import { getUser, getUserOrgRole } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const member = await getUserOrgRole(user.id)

    return NextResponse.json({
      id: user.id,
      email: user.email,
      role: member?.role || 'viewer',
      display_name: member?.display_name || user.email?.split('@')[0] || 'User',
    })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
