#!/usr/bin/env node
/**
 * Migrate ad creative images to Supabase Storage with fresh Meta API URLs
 */
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://qjpkeznwhrgnrlejhplg.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqcGtlem53aHJnbnJsZWpocGxnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc5Mzc2NywiZXhwIjoyMDg3MzY5NzY3fQ.doLmrqk8fEjbYwOVy11iX7wsq-TN7uCsgPAcsG6TxGo';
const BUCKET = 'ad-creatives';
const META_API = 'https://graph.facebook.com/v21.0';

// Load secrets
function loadEnv(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    for (const line of content.split('\n')) {
      if (!line || line.startsWith('#')) continue;
      const [key, ...vals] = line.split('=');
      process.env[key.trim()] = vals.join('=').trim();
    }
  } catch {}
}
const secretsDir = path.resolve(__dirname, '../../.secrets');
loadEnv(path.join(secretsDir, 'meta-api.env'));
loadEnv(path.join(secretsDir, 'supabase-db.env'));

const META_TOKEN = process.env.META_ACCESS_TOKEN;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const pool = new Pool({
  host: 'db.qjpkeznwhrgnrlejhplg.supabase.co',
  port: 5432, database: 'postgres', user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD || 'zuq@BZB!kjr7hqw8znv',
  ssl: { rejectUnauthorized: false }
});

async function fetchFreshImageUrl(adId) {
  try {
    const url = `${META_API}/${adId}/adcreatives?fields=image_url,thumbnail_url,object_story_spec&access_token=${META_TOKEN}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    const cr = data.data?.[0];
    if (!cr) return null;
    let imageUrl = cr.image_url || null;
    if (!imageUrl) {
      const spec = cr.object_story_spec;
      imageUrl = spec?.link_data?.image_url || spec?.photo_data?.url || spec?.video_data?.image_url || null;
    }
    if (!imageUrl) imageUrl = cr.thumbnail_url;
    return imageUrl;
  } catch { return null; }
}

async function downloadImage(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 1000) return null;
    return { buffer, contentType: ct };
  } catch { return null; }
}

async function main() {
  if (!META_TOKEN) { console.error('Missing META_ACCESS_TOKEN'); process.exit(1); }

  const { rows: ads } = await pool.query(
    "SELECT id, platform_ad_id, ad_account_id, creative_url FROM ads WHERE stored_creative_url IS NULL AND creative_url IS NOT NULL ORDER BY updated_at DESC"
  );
  console.log(`Found ${ads.length} ads to migrate\n`);

  let success = 0, failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < ads.length; i++) {
    const ad = ads[i];

    // First try existing URL (might still be valid for recently synced ads)
    let img = await downloadImage(ad.creative_url);

    // If expired, fetch fresh URL from Meta API
    if (!img) {
      const freshUrl = await fetchFreshImageUrl(ad.platform_ad_id);
      if (freshUrl) {
        img = await downloadImage(freshUrl);
        // Also update the creative_url in DB with fresh URL
        if (img) {
          await pool.query('UPDATE ads SET creative_url = $1 WHERE id = $2', [freshUrl, ad.id]);
        }
      }
    }

    if (!img) {
      failed++;
      continue;
    }

    const ext = img.contentType.includes('png') ? 'png' : 'jpg';
    const storagePath = `${ad.ad_account_id}/${ad.platform_ad_id}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, img.buffer, { contentType: img.contentType, upsert: true });
    if (error) { failed++; continue; }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = urlData?.publicUrl;
    if (!publicUrl) { failed++; continue; }

    await pool.query('UPDATE ads SET stored_creative_url = $1, stored_thumbnail_url = $1 WHERE id = $2', [publicUrl, ad.id]);
    success++;

    if ((success + failed) % 100 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const pct = (((i + 1) / ads.length) * 100).toFixed(1);
      console.log(`[${pct}%] ${success} stored, ${failed} failed (${elapsed}s elapsed)`);
    }

    // Rate limit: ~2 requests per ad (Meta API + download), pace to avoid 429s
    if (i % 5 === 0) await new Promise(r => setTimeout(r, 200));
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\nDone! ${success} stored, ${failed} failed out of ${ads.length} (${elapsed}s)`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
