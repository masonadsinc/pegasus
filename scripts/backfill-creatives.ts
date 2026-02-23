#!/usr/bin/env npx tsx
/**
 * Backfill creative images/videos for ads missing creative_url.
 * 
 * Priority chain:
 * 1. Permanent post image via effective_object_story_id → full_picture
 * 2. Thumbnail fallback via creative thumbnail_url (480px)
 * 3. Object story spec image_url
 * 
 * For videos: fetch video source URL via /{video_id}?fields=source
 * 
 * Usage: npx tsx scripts/backfill-creatives.ts [--dry-run] [--limit 100]
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const META_TOKEN = process.env.META_ACCESS_TOKEN || ''
const META_VERSION = process.env.META_API_VERSION || 'v21.0'
const BASE = `https://graph.facebook.com/${META_VERSION}`

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const LIMIT = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) || 500 : 500
const BATCH_SIZE = 50
const BATCH_DELAY = 100
const PER_VIDEO_DELAY = 50

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

let apiCalls = 0
let updated = 0
let errors = 0

async function metaGet(path: string, params: Record<string, string> = {}): Promise<any | null> {
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('access_token', META_TOKEN)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  apiCalls++
  try {
    const res = await fetch(url.toString())
    if (!res.ok) {
      const body = await res.text()
      if (body.includes('rate limit')) {
        console.log('⏳ Rate limited, waiting 60s...')
        await sleep(60000)
        return metaGet(path, params) // retry once
      }
      return null
    }
    return res.json()
  } catch { return null }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function fetchCreativeForAd(ad: any): Promise<{
  creative_url?: string
  creative_thumbnail_url?: string
  creative_video_url?: string
  creative_body?: string
  creative_headline?: string
  creative_cta?: string
} | null> {
  const updates: any = {}
  const adId = ad.platform_ad_id

  // Step 1: Get ad creative details via /adcreatives edge
  const creativeRes = await metaGet(`/${adId}/adcreatives`, {
    fields: 'id,effective_object_story_id,thumbnail_url,image_url,object_story_spec,body,title,call_to_action_type'
  })
  if (!creativeRes?.data?.[0]) return null

  const creative = creativeRes.data[0]
  const storyId = creative.effective_object_story_id

  // Extract copy if missing
  if (!ad.creative_body && creative?.body) updates.creative_body = creative.body
  if (!ad.creative_headline && creative?.title) updates.creative_headline = creative.title
  if (!ad.creative_cta && creative?.call_to_action_type) updates.creative_cta = creative.call_to_action_type
  if (storyId) updates.object_story_id = storyId

  // Step 2: Try permanent post image (best quality)
  if (storyId) {
    const postData = await metaGet(`/${storyId}`, {
      fields: 'full_picture,attachments{media,subattachments}'
    })
    if (postData?.full_picture) {
      updates.creative_url = postData.full_picture
      updates.creative_thumbnail_url = postData.full_picture
    } else if (postData?.attachments?.data?.[0]?.media?.image?.src) {
      updates.creative_url = postData.attachments.data[0].media.image.src
    }
  }

  // Step 3: Creative image_url fallback
  if (!updates.creative_url && creative?.image_url) {
    updates.creative_url = creative.image_url
  }

  // Step 4: Object story spec fallback
  if (!updates.creative_url && creative?.object_story_spec) {
    const spec = creative.object_story_spec
    const imgUrl = spec.link_data?.image_url || spec.photo_data?.url || spec.video_data?.image_url
    if (imgUrl) updates.creative_url = imgUrl
  }

  // Step 5: Thumbnail from creative response (already fetched)
  if (!updates.creative_url && creative?.thumbnail_url) {
    updates.creative_thumbnail_url = creative.thumbnail_url
    updates.creative_url = creative.thumbnail_url
  }

  // Step 6: Video source
  const videoId = creative?.object_story_spec?.video_data?.video_id
  if (videoId) {
    await sleep(PER_VIDEO_DELAY)
    const videoData = await metaGet(`/${videoId}`, { fields: 'source,thumbnails' })
    if (videoData?.source) updates.creative_video_url = videoData.source
    if (videoData?.thumbnails?.data?.[0]?.uri && !updates.creative_url) {
      updates.creative_url = videoData.thumbnails.data[0].uri
    }
  }

  return Object.keys(updates).length > 0 ? updates : null
}

async function main() {
  console.log(`\n🎨 Creative Backfill Script`)
  console.log(`${DRY_RUN ? '🔍 DRY RUN — no writes' : '✏️  LIVE — will update database'}`)
  console.log(`Limit: ${LIMIT} ads, Batch size: ${BATCH_SIZE}\n`)

  // Fetch ads missing creative_url
  const { data: ads, error } = await sb
    .from('ads')
    .select('id, platform_ad_id, creative_url, creative_thumbnail_url, creative_video_url, creative_body, creative_headline, creative_cta')
    .is('creative_url', null)
    .limit(LIMIT)
    .order('updated_at', { ascending: false })

  if (error) { console.error('DB error:', error); process.exit(1) }
  console.log(`Found ${ads?.length || 0} ads without creative_url\n`)
  if (!ads || ads.length === 0) { console.log('Nothing to do!'); return }

  // Process in batches
  for (let i = 0; i < ads.length; i += BATCH_SIZE) {
    const batch = ads.slice(i, i + BATCH_SIZE)
    console.log(`\n── Batch ${Math.floor(i / BATCH_SIZE) + 1} (${i + 1}-${Math.min(i + BATCH_SIZE, ads.length)} of ${ads.length}) ──`)

    for (const ad of batch) {
      try {
        const updates = await fetchCreativeForAd(ad)
        if (updates) {
          if (DRY_RUN) {
            console.log(`  ✅ ${ad.platform_ad_id} → ${Object.keys(updates).join(', ')}`)
          } else {
            const { error: updateError } = await sb
              .from('ads')
              .update({ ...updates, updated_at: new Date().toISOString() })
              .eq('id', ad.id)
            if (updateError) {
              console.log(`  ❌ ${ad.platform_ad_id} — DB error: ${updateError.message}`)
              errors++
            } else {
              console.log(`  ✅ ${ad.platform_ad_id} — updated ${Object.keys(updates).length} fields`)
              updated++
            }
          }
        } else {
          console.log(`  ⚪ ${ad.platform_ad_id} — no creative found`)
        }
      } catch (e: any) {
        console.log(`  ❌ ${ad.platform_ad_id} — ${e.message}`)
        errors++
      }
    }

    if (i + BATCH_SIZE < ads.length) {
      await sleep(BATCH_DELAY)
    }
  }

  console.log(`\n═══════════════════════════════`)
  console.log(`✅ Updated: ${updated}`)
  console.log(`❌ Errors: ${errors}`)
  console.log(`📡 API calls: ${apiCalls}`)
  console.log(`═══════════════════════════════\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
