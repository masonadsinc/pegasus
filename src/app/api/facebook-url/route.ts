import { NextRequest, NextResponse } from 'next/server'

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN!
const META_API_VERSION = process.env.META_API_VERSION || 'v21.0'
const BASE = `https://graph.facebook.com/${META_API_VERSION}`

async function metaGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('access_token', META_ACCESS_TOKEN)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString())
  if (!res.ok) return null
  return res.json()
}

export async function GET(req: NextRequest) {
  const adId = req.nextUrl.searchParams.get('ad_id')
  if (!adId) return NextResponse.json({ error: 'ad_id required' }, { status: 400 })

  try {
    // 1. Try preview_shareable_link from ad previews
    const previewData = await metaGet(`/${adId}`, { fields: 'preview_shareable_link' })
    if (previewData?.preview_shareable_link) {
      return NextResponse.json({ url: previewData.preview_shareable_link, source: 'preview' })
    }

    // 2. Try constructing URL from effective_object_story_id
    const storyData = await metaGet(`/${adId}`, { fields: 'effective_object_story_id,creative{object_story_spec}' })
    if (storyData?.effective_object_story_id) {
      const [pageId, postId] = storyData.effective_object_story_id.split('_')
      if (pageId && postId) {
        // Check if it's a video post
        const postData = await metaGet(`/${storyData.effective_object_story_id}`, { fields: 'type' })
        if (postData?.type === 'video') {
          // Try to get video ID from story spec
          const videoData = storyData?.creative?.object_story_spec?.video_data?.video_id
          if (videoData) {
            return NextResponse.json({ url: `https://www.facebook.com/${pageId}/videos/${videoData}`, source: 'video' })
          }
        }
        return NextResponse.json({ url: `https://www.facebook.com/${pageId}/posts/${postId}`, source: 'post' })
      }
    }

    // 3. Fallback to Ad Library
    return NextResponse.json({ url: `https://www.facebook.com/ads/library/?id=${adId}`, source: 'library' })
  } catch {
    return NextResponse.json({ url: `https://www.facebook.com/ads/library/?id=${adId}`, source: 'library' })
  }
}
