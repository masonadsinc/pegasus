#!/usr/bin/env npx tsx
/**
 * Fix ads where creative_url is the page profile picture instead of actual ad creative.
 * Profile pics use Meta CDN path pattern /t39.30808-1/ 
 * 
 * Re-fetches from Meta API with better priority:
 * 1. adcreative image_url (direct creative image)
 * 2. adcreative thumbnail_url (480px thumbnail)
 * 3. object_story_spec image URLs
 * 4. video thumbnail if video ad
 * 5. attachments from post (skip full_picture which causes the profile pic issue)
 * 
 * Usage: npx tsx scripts/fix-profile-pics.ts [--dry-run] [--limit 200] [--account-id UUID]
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
const ACCOUNT_ID = args.includes('--account-id') ? args[args.indexOf('--account-id') + 1] : null

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)
let apiCalls = 0, updated = 0, skipped = 0, errors = 0

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
        await new Promise(r => setTimeout(r, 60000))
        return metaGet(path, params)
      }
      return null
    }
    return res.json()
  } catch { return null }
}

function isProfilePic(url: string): boolean {
  return url.includes('/t39.30808-1/')
}

async function fixAd(ad: any): Promise<string | null> {
  const adId = ad.platform_ad_id

  // Get adcreative details
  const res = await metaGet(`/${adId}/adcreatives`, {
    fields: 'id,image_url,thumbnail_url,object_story_spec,effective_object_story_id'
  })
  if (!res?.data?.[0]) return null

  const creative = res.data[0]
  let newUrl: string | null = null

  // Priority 1: image_url from creative (direct ad image, best source)
  if (creative.image_url && !isProfilePic(creative.image_url)) {
    newUrl = creative.image_url
  }

  // Priority 2: thumbnail_url from creative
  if (!newUrl && creative.thumbnail_url && !isProfilePic(creative.thumbnail_url)) {
    newUrl = creative.thumbnail_url
  }

  // Priority 3: object_story_spec images
  if (!newUrl && creative.object_story_spec) {
    const spec = creative.object_story_spec
    const candidates = [
      spec.link_data?.image_url,
      spec.link_data?.picture,
      spec.photo_data?.url,
      spec.photo_data?.images?.[0]?.url,
      spec.video_data?.image_url,
      spec.video_data?.call_to_action?.value?.link_caption,
    ].filter(Boolean)
    for (const c of candidates) {
      if (c && !isProfilePic(c)) { newUrl = c; break }
    }
  }

  // Priority 4: post attachments (NOT full_picture)
  if (!newUrl && creative.effective_object_story_id) {
    const post = await metaGet(`/${creative.effective_object_story_id}`, {
      fields: 'attachments{media,subattachments}'
    })
    const media = post?.attachments?.data?.[0]?.media?.image?.src
    if (media && !isProfilePic(media)) newUrl = media
    // Check subattachments (carousel)
    if (!newUrl) {
      const sub = post?.attachments?.data?.[0]?.subattachments?.data
      if (sub?.[0]?.media?.image?.src && !isProfilePic(sub[0].media.image.src)) {
        newUrl = sub[0].media.image.src
      }
    }
  }

  // Priority 5: Video thumbnail
  if (!newUrl) {
    const videoId = creative.object_story_spec?.video_data?.video_id
    if (videoId) {
      const vid = await metaGet(`/${videoId}`, { fields: 'thumbnails' })
      const thumb = vid?.thumbnails?.data?.[0]?.uri
      if (thumb && !isProfilePic(thumb)) newUrl = thumb
    }
  }

  if (!newUrl) return null
  if (newUrl === ad.creative_url) return null // same URL

  if (!DRY_RUN) {
    const { error } = await sb.from('ads').update({
      creative_url: newUrl,
      creative_thumbnail_url: newUrl,
      updated_at: new Date().toISOString()
    }).eq('id', ad.id)
    if (error) { errors++; return `DB error: ${error.message}` }
  }

  updated++
  return newUrl
}

async function main() {
  console.log(`\n🔧 Fix Profile Pic Creatives`)
  console.log(`${DRY_RUN ? '🔍 DRY RUN' : '✏️  LIVE'} | Limit: ${LIMIT}${ACCOUNT_ID ? ` | Account: ${ACCOUNT_ID}` : ' | All accounts'}\n`)

  // Find ads with profile pic URLs
  let query = sb.from('ads')
    .select('id, platform_ad_id, ad_account_id, name, creative_url')
    .like('creative_url', '%/t39.30808-1/%')
    .limit(LIMIT)

  if (ACCOUNT_ID) query = query.eq('ad_account_id', ACCOUNT_ID)

  const { data: ads, error } = await query
  if (error) { console.error('DB error:', error); process.exit(1) }

  console.log(`Found ${ads?.length || 0} ads with profile pic URLs\n`)
  if (!ads?.length) { console.log('Nothing to fix!'); return }

  for (let i = 0; i < ads.length; i++) {
    const ad = ads[i]
    try {
      const result = await fixAd(ad)
      if (result && !result.startsWith('DB error')) {
        console.log(`  ✅ ${ad.platform_ad_id} — ${ad.name?.slice(0, 45)}`)
        console.log(`     → ${result.slice(0, 90)}`)
      } else if (result) {
        console.log(`  ❌ ${ad.platform_ad_id} — ${result}`)
      } else {
        skipped++
        console.log(`  ⚪ ${ad.platform_ad_id} — no better image found`)
      }
    } catch (e: any) {
      errors++
      console.log(`  ❌ ${ad.platform_ad_id} — ${e.message}`)
    }

    // Small delay every 10 ads
    if (i % 10 === 9) await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\n═══════════════════════════════`)
  console.log(`✅ Fixed: ${updated}`)
  console.log(`⚪ Skipped: ${skipped} (no better image)`)
  console.log(`❌ Errors: ${errors}`)
  console.log(`📡 API calls: ${apiCalls}`)
  console.log(`═══════════════════════════════\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
