import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

// Accepts image upload, returns base64 data URL for use in generation
// Images stay client-side as data URLs — no persistent storage needed
export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const files = formData.getAll('images') as File[]

  if (!files.length) return NextResponse.json({ error: 'No images provided' }, { status: 400 })

  const results = []
  for (const file of files.slice(0, 6)) {
    if (!file.type.startsWith('image/')) continue
    if (file.size > 10 * 1024 * 1024) continue // 10MB max per image

    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const dataUrl = `data:${file.type};base64,${base64}`

    results.push({
      name: file.name,
      size: file.size,
      type: file.type,
      dataUrl,
    })
  }

  return NextResponse.json({ images: results })
}
