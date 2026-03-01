#!/usr/bin/env node
/**
 * Run Meta sync — called by cron or manually
 * 
 * Usage:
 *   node run-sync.js                    # Yesterday (default daily sync)
 *   node run-sync.js --days 7           # Last 7 days
 *   node run-sync.js --from 2026-02-01 --to 2026-02-15  # Custom range
 *   node run-sync.js --backfill 90      # 90-day backfill (14-day batches)
 */

const MetaSync = require('./sync');
const fs = require('fs');
const path = require('path');

// Load env
function loadEnv(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  for (const line of content.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [key, ...vals] = line.split('=');
    process.env[key.trim()] = vals.join('=').trim();
  }
}

const secretsDir = path.resolve(__dirname, '../../.secrets') || path.resolve(process.env.HOME || '/home/node', '.openclaw/workspace/.secrets');
const altSecretsDir = path.resolve(process.env.HOME || '/home/node', '.openclaw/workspace/.secrets');

// Try workspace secrets first, then fallback
for (const dir of [secretsDir, altSecretsDir]) {
  try { loadEnv(path.join(dir, 'meta-api.env')); } catch(e) {}
  try { loadEnv(path.join(dir, 'supabase-db.env')); } catch(e) {}
  try { loadEnv(path.join(dir, 'supabase.env')); } catch(e) {}
}

// Parse args
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : null;
}

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

async function main() {
  const dbConfig = {
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT || '5432'),
    database: process.env.SUPABASE_DB_NAME || 'postgres',
    user: process.env.SUPABASE_DB_USER || 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD,
  };

  const token = process.env.META_ACCESS_TOKEN;
  const orgId = process.env.ADSINC_ORG_ID;

  if (!token || !orgId || !dbConfig.host) {
    console.error('Missing required env vars. Need META_ACCESS_TOKEN, ADSINC_ORG_ID, SUPABASE_DB_*');
    process.exit(1);
  }

  // Create Supabase client for storage operations
  const { createClient } = require('@supabase/supabase-js');
  const supabaseUrl = process.env.SUPABASE_URL || `https://${(dbConfig.host || '').replace('db.', '').replace('.supabase.co', '')}.supabase.co`;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const supabase = supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

  const sync = new MetaSync(dbConfig, token, orgId, supabase);
  await sync.connect();

  const backfillDays = getArg('backfill');
  if (backfillDays) {
    // Backfill in 14-day batches (Meta times out on larger ranges)
    const totalDays = parseInt(backfillDays);
    const batchSize = 14;
    console.log(`🔄 Backfilling ${totalDays} days in ${Math.ceil(totalDays/batchSize)} batches of ${batchSize} days`);

    for (let offset = totalDays; offset > 0; offset -= batchSize) {
      const batchEnd = new Date();
      batchEnd.setDate(batchEnd.getDate() - Math.max(offset - batchSize, 0));
      const batchStart = new Date();
      batchStart.setDate(batchStart.getDate() - offset);

      console.log(`\n━━━ Batch: ${formatDate(batchStart)} → ${formatDate(batchEnd)} ━━━`);
      
      // Reset stats for each batch
      sync.stats = { accounts: 0, campaigns: 0, adSets: 0, ads: 0, insights: 0, breakdowns: 0, errors: 0 };
      await sync.syncAll(formatDate(batchStart), formatDate(batchEnd), { 
        syncType: 'backfill',
        skipBreakdowns: true  // Skip breakdowns for backfill to save API calls
      });
    }
  } else {
    const fromDate = getArg('from');
    const toDate = getArg('to');
    const days = getArg('days');

    let dateStart, dateEnd;

    if (fromDate && toDate) {
      dateStart = fromDate;
      dateEnd = toDate;
    } else if (days) {
      // End = yesterday (today's data is incomplete at sync time)
      // Start = N days before yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const start = new Date();
      start.setDate(start.getDate() - parseInt(days));
      dateStart = formatDate(start);
      dateEnd = formatDate(yesterday);
    } else {
      // Default: yesterday only
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      dateStart = formatDate(yesterday);
      dateEnd = formatDate(yesterday);
    }

    await sync.syncAll(dateStart, dateEnd, { 
      syncType: fromDate ? 'full' : 'incremental',
      breakdownDaysBack: days ? 2 : null  // On rolling syncs, only breakdown last 2 days
    });
  }

  await sync.close();
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
