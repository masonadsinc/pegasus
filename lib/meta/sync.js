/**
 * Meta Ads Sync Pipeline
 * Pulls structure (campaigns/ad sets/ads) + insights at all levels + breakdowns
 * into Supabase for all ad accounts in an org.
 */

const { Client } = require('pg');
const api = require('./api');

// Parse actions array from Meta into individual metrics
function parseActions(actions) {
  if (!actions || !Array.isArray(actions)) return {};
  const map = {};
  for (const a of actions) {
    map[a.action_type] = parseInt(a.value) || 0;
  }
  return map;
}

function parseActionValues(actionValues) {
  if (!actionValues || !Array.isArray(actionValues)) return {};
  const map = {};
  for (const a of actionValues) {
    map[a.action_type] = parseFloat(a.value) || 0;
  }
  return map;
}

// Extract video metric from the weird Meta format
function videoMetric(arr) {
  if (!arr || !Array.isArray(arr)) return 0;
  const item = arr.find(a => a.action_type === 'video_view');
  return parseInt(item?.value) || 0;
}

class MetaSync {
  constructor(dbConfig, metaToken, orgId) {
    this.db = new Client({ ...dbConfig, ssl: { rejectUnauthorized: false } });
    this.token = metaToken;
    this.orgId = orgId;
    this.stats = { accounts: 0, campaigns: 0, adSets: 0, ads: 0, insights: 0, breakdowns: 0, errors: 0 };
  }

  async connect() {
    await this.db.connect();
  }

  async close() {
    await this.db.end();
  }

  /**
   * Get all active ad accounts for this org
   */
  async getAccounts() {
    const res = await this.db.query(
      'SELECT id, platform_account_id, name, objective, primary_action_type, target_cpl, target_roas, last_synced_at FROM ad_accounts WHERE org_id = $1 AND is_active = true',
      [this.orgId]
    );
    return res.rows;
  }

  /**
   * Sync campaign/ad set/ad structure for one account
   */
  async syncStructure(account) {
    const { id: dbAccountId, platform_account_id: accountId } = account;
    console.log(`\n  📂 Syncing structure for ${account.name}...`);

    // Campaigns
    const campaigns = await api.getCampaigns(accountId, this.token);
    for (const c of campaigns) {
      await this.db.query(`
        INSERT INTO campaigns (org_id, ad_account_id, platform_campaign_id, name, status, objective, daily_budget, lifetime_budget, buying_type, special_ad_categories, created_time, start_time, stop_time)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (ad_account_id, platform_campaign_id) DO UPDATE SET
          name=EXCLUDED.name, status=EXCLUDED.status, daily_budget=EXCLUDED.daily_budget,
          lifetime_budget=EXCLUDED.lifetime_budget, updated_at=now()
      `, [
        this.orgId, dbAccountId, c.id, c.name, c.status, c.objective,
        c.daily_budget ? c.daily_budget / 100 : null,
        c.lifetime_budget ? c.lifetime_budget / 100 : null,
        c.buying_type, JSON.stringify(c.special_ad_categories || []),
        c.created_time, c.start_time, c.stop_time
      ]);
    }
    this.stats.campaigns += campaigns.length;
    console.log(`    ${campaigns.length} campaigns`);

    // Ad Sets
    const adSets = await api.getAdSets(accountId, this.token);
    for (const as of adSets) {
      // Check if ad set is in learning phase based on status
      const isLearning = as.status === 'ACTIVE' && as.effective_status === 'LEARNING';

      await this.db.query(`
        INSERT INTO ad_sets (org_id, ad_account_id, campaign_id, platform_ad_set_id, name, status, daily_budget, lifetime_budget, bid_strategy, optimization_goal, billing_event, attribution_setting, start_time, end_time, created_time)
        VALUES ($1,$2,(SELECT id FROM campaigns WHERE ad_account_id=$2 AND platform_campaign_id=$3),$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (ad_account_id, platform_ad_set_id) DO UPDATE SET
          name=EXCLUDED.name, status=EXCLUDED.status, daily_budget=EXCLUDED.daily_budget,
          lifetime_budget=EXCLUDED.lifetime_budget,
          bid_strategy=EXCLUDED.bid_strategy, optimization_goal=EXCLUDED.optimization_goal,
          billing_event=EXCLUDED.billing_event, attribution_setting=EXCLUDED.attribution_setting,
          updated_at=now()
      `, [
        this.orgId, dbAccountId, as.campaign_id, as.id, as.name, as.status,
        as.daily_budget ? as.daily_budget / 100 : null,
        as.lifetime_budget ? as.lifetime_budget / 100 : null,
        as.bid_strategy, as.optimization_goal, as.billing_event,
        as.attribution_setting, as.start_time, as.end_time, as.created_time
      ]);
    }
    this.stats.adSets += adSets.length;
    console.log(`    ${adSets.length} ad sets`);

    // Ads (structure only — lightweight). Falls back to per-campaign fetch for large accounts.
    let ads;
    try {
      ads = await api.getAds(accountId, this.token);
    } catch(e) {
      console.log(`    ⚠️ Bulk ads fetch failed, falling back to per-campaign...`);
      const campaignIds = campaigns.map(c => c.id);
      ads = await api.getAds(accountId, this.token, campaignIds);
    }
    for (const ad of ads) {
      await this.db.query(`
        INSERT INTO ads (org_id, ad_account_id, ad_set_id, platform_ad_id, name, status, effective_status, leadgen_form_id, created_time)
        VALUES ($1,$2,(SELECT id FROM ad_sets WHERE ad_account_id=$2 AND platform_ad_set_id=$3),$4,$5,$6,$7,$8,$9)
        ON CONFLICT (ad_account_id, platform_ad_id) DO UPDATE SET
          name=EXCLUDED.name, status=EXCLUDED.status, effective_status=EXCLUDED.effective_status, updated_at=now()
      `, [
        this.orgId, dbAccountId, ad.adset_id, ad.id, ad.name, ad.status,
        ad.effective_status, ad.lead_gen_form_id, ad.created_time
      ]);
    }
    this.stats.ads += ads.length;
    console.log(`    ${ads.length} ads`);

    // Fetch creatives for ads missing creative_url
    await this.syncCreatives(dbAccountId, ads);
  }

  /**
   * Sync creative data (images, copy, CTA) for ads missing creative_url
   */
  async syncCreatives(dbAccountId, ads) {
    // Find which ads are missing creative_url in DB
    const res = await this.db.query(
      'SELECT platform_ad_id FROM ads WHERE ad_account_id = $1 AND creative_url IS NULL',
      [dbAccountId]
    );
    const missingSet = new Set(res.rows.map(r => r.platform_ad_id));
    const toFetch = ads.filter(a => missingSet.has(a.id)).map(a => a.id);

    if (toFetch.length === 0) {
      console.log(`    ✅ All ads have creatives`);
      return;
    }

    console.log(`    🎨 Fetching creatives for ${toFetch.length} ads...`);

    try {
      const creatives = await api.getAdCreatives(toFetch, this.token);
      let updated = 0;

      for (const c of creatives) {
        const cr = c.creative;
        if (!cr || (!cr.image_url && !cr.body && !cr.title)) continue;

        const sets = [];
        const vals = [dbAccountId, c.ad_id];
        let paramIdx = 3;

        if (cr.image_url) { sets.push(`creative_url = $${paramIdx++}`); vals.push(cr.image_url); }
        if (cr.thumbnail_url) { sets.push(`creative_thumbnail_url = $${paramIdx++}`); vals.push(cr.thumbnail_url); }
        if (cr.video_url) { sets.push(`creative_video_url = $${paramIdx++}`); vals.push(cr.video_url); }
        if (cr.body) { sets.push(`creative_body = $${paramIdx++}`); vals.push(cr.body); }
        if (cr.title) { sets.push(`creative_headline = $${paramIdx++}`); vals.push(cr.title); }
        if (cr.call_to_action_type) { sets.push(`creative_cta = $${paramIdx++}`); vals.push(cr.call_to_action_type); }

        if (sets.length > 0) {
          sets.push('updated_at = now()');
          await this.db.query(
            `UPDATE ads SET ${sets.join(', ')} WHERE ad_account_id = $1 AND platform_ad_id = $2`,
            vals
          );
          updated++;
        }
      }

      console.log(`    🎨 Updated creatives for ${updated}/${toFetch.length} ads`);
    } catch(e) {
      console.log(`    ⚠️ Creative sync error: ${e.message}`);
    }
  }

  /**
   * Sync insights at one level for one account
   */
  async syncInsights(account, level, dateStart, dateEnd) {
    const { id: dbAccountId, platform_account_id: accountId, primary_action_type } = account;
    const apiLevel = level === 'ad_set' ? 'adset' : level;
    const dbLevel = level === 'adset' ? 'ad_set' : level;
    console.log(`  📊 ${dbLevel}-level insights ${dateStart} → ${dateEnd}...`);

    let rows;
    try {
      rows = await api.getInsights(accountId, this.token, apiLevel, dateStart, dateEnd);
    } catch(e) {
      // If the full range fails (large accounts), split into daily batches
      if (e.message.includes('reduce the amount') || e.message.includes('unknown error') || e.message.includes('code 1')) {
        console.log(`    ⚠️ Range too large, splitting into daily batches...`);
        rows = [];
        const start = new Date(dateStart);
        const end = new Date(dateEnd);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dayStr = d.toISOString().split('T')[0];
          try {
            const dayRows = await api.getInsights(accountId, this.token, apiLevel, dayStr, dayStr);
            rows.push(...dayRows);
          } catch(e2) {
            console.log(`    ⚠️ ${dayStr} failed: ${e2.message}`);
            this.stats.errors++;
          }
        }
      } else {
        throw e;
      }
    }

    for (const r of rows) {
      const actions = parseActions(r.actions);
      const actionValues = parseActionValues(r.action_values);
      // conversions field has custom conversion types (schedule_total, etc.) that actions doesn't
      const conversions = parseActions(r.conversions);
      const conversionValues = parseActionValues(r.conversion_values);

      // CRITICAL: Use primary_action_type if set. Don't fall through to generic list.
      // This prevents phantom conversions (e.g. counting complete_registration as a lead).
      let leads = 0, purchases = 0, purchaseValue = 0, schedules = 0;

      if (primary_action_type) {
        // Check both actions and conversions — some types only appear in conversions
        const count = actions[primary_action_type] || conversions[primary_action_type] || 0;
        const value = actionValues[primary_action_type] || conversionValues[primary_action_type] || 0;

        if (primary_action_type === 'schedule_total') {
          schedules = count;
        } else if (['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_web_purchase'].includes(primary_action_type)) {
          purchases = count;
          purchaseValue = value;
        } else {
          // lead, offsite_conversion.fb_pixel_lead, offsite_conversion.fb_pixel_custom, etc.
          leads = count;
        }
      } else {
        // Fallback for accounts without explicit action type (shouldn't happen)
        leads = actions.lead || actions['offsite_conversion.fb_pixel_lead'] || 0;
        purchases = actions.purchase || actions['offsite_conversion.fb_pixel_purchase'] || actions.omni_purchase || 0;
        purchaseValue = actionValues.purchase || actionValues['offsite_conversion.fb_pixel_purchase'] || actionValues.omni_purchase || 0;
        schedules = conversions.schedule_total || actions.schedule_total || 0;
      }

      const landingPageViews = actions.landing_page_view || 0;
      const messagingStarted = actions['onsite_conversion.messaging_conversation_started_7d'] || 0;

      await this.db.query(`
        INSERT INTO insights (
          org_id, ad_account_id, level,
          platform_campaign_id, platform_ad_set_id, platform_ad_id,
          date, spend, impressions, reach, frequency,
          clicks, inline_link_clicks, outbound_clicks, landing_page_views,
          leads, purchases, purchase_value, schedules, messaging_conversations_started,
          video_plays, video_p25, video_p50, video_p75, video_p100, video_thruplay,
          quality_ranking, engagement_rate_ranking, conversion_rate_ranking,
          actions_json, action_values_json, cost_per_action_json
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32
        ) ON CONFLICT (ad_account_id, level, platform_campaign_id, COALESCE(platform_ad_set_id, ''), COALESCE(platform_ad_id, ''), date)
        DO UPDATE SET
          spend=EXCLUDED.spend, impressions=EXCLUDED.impressions, reach=EXCLUDED.reach,
          frequency=EXCLUDED.frequency, clicks=EXCLUDED.clicks,
          inline_link_clicks=EXCLUDED.inline_link_clicks, outbound_clicks=EXCLUDED.outbound_clicks,
          landing_page_views=EXCLUDED.landing_page_views,
          leads=EXCLUDED.leads, purchases=EXCLUDED.purchases, purchase_value=EXCLUDED.purchase_value,
          schedules=EXCLUDED.schedules, messaging_conversations_started=EXCLUDED.messaging_conversations_started,
          video_plays=EXCLUDED.video_plays, video_p25=EXCLUDED.video_p25, video_p50=EXCLUDED.video_p50,
          video_p75=EXCLUDED.video_p75, video_p100=EXCLUDED.video_p100, video_thruplay=EXCLUDED.video_thruplay,
          quality_ranking=EXCLUDED.quality_ranking, engagement_rate_ranking=EXCLUDED.engagement_rate_ranking,
          conversion_rate_ranking=EXCLUDED.conversion_rate_ranking,
          actions_json=EXCLUDED.actions_json, action_values_json=EXCLUDED.action_values_json,
          cost_per_action_json=EXCLUDED.cost_per_action_json,
          synced_at=now()
      `, [
        this.orgId, dbAccountId, dbLevel,
        r.campaign_id, r.adset_id || null, r.ad_id || null,
        r.date_start,
        parseFloat(r.spend) || 0,
        parseInt(r.impressions) || 0,
        parseInt(r.reach) || 0,
        parseFloat(r.frequency) || null,
        parseInt(r.clicks) || 0,
        parseInt(r.inline_link_clicks) || 0,
        parseInt(r.outbound_clicks?.[0]?.value) || 0,
        landingPageViews,
        leads, purchases, purchaseValue, schedules, messagingStarted,
        videoMetric(r.video_play_actions),
        videoMetric(r.video_p25_watched_actions),
        videoMetric(r.video_p50_watched_actions),
        videoMetric(r.video_p75_watched_actions),
        videoMetric(r.video_p100_watched_actions),
        videoMetric(r.video_thruplay_watched_actions),
        r.quality_ranking, r.engagement_rate_ranking, r.conversion_rate_ranking,
        JSON.stringify(r.actions || []),
        JSON.stringify(r.action_values || []),
        JSON.stringify(r.cost_per_action_type || [])
      ]);
      this.stats.insights++;
    }
    console.log(`    ${rows.length} rows`);
  }

  /**
   * Sync breakdowns for one account at one level
   */
  async syncBreakdowns(account, level, dateStart, dateEnd) {
    const { id: dbAccountId, platform_account_id: accountId, primary_action_type } = account;

    const breakdownConfigs = [
      { type: 'age_gender', breakdowns: ['age', 'gender'] },
      { type: 'device', breakdowns: ['device_platform', 'impression_device'] },
      { type: 'placement', breakdowns: ['publisher_platform', 'platform_position'] },
      { type: 'region', breakdowns: ['country', 'region'] },
      { type: 'hourly', breakdowns: 'hourly_stats_aggregated_by_advertiser_time_zone' },
    ];

    const apiLevel = level === 'ad_set' ? 'adset' : level;
    const dbLevel = level === 'adset' ? 'ad_set' : level;
    for (const bc of breakdownConfigs) {
      try {
        console.log(`  📈 ${level} ${bc.type} breakdown...`);
        const rows = await api.getBreakdownInsights(accountId, this.token, apiLevel, dateStart, dateEnd, bc.breakdowns);

        for (const r of rows) {
          const actions = parseActions(r.actions);
          let leads = 0, purchases = 0;
          if (primary_action_type) {
            const count = actions[primary_action_type] || 0;
            if (['omni_purchase','purchase','offsite_conversion.fb_pixel_purchase','onsite_web_purchase'].includes(primary_action_type)) {
              purchases = count;
            } else {
              leads = count;
            }
          } else {
            leads = actions.lead || actions['offsite_conversion.fb_pixel_lead'] || 0;
            purchases = actions.purchase || actions['offsite_conversion.fb_pixel_purchase'] || 0;
          }

          let dim1, dim2;
          if (bc.type === 'age_gender') { dim1 = r.age; dim2 = r.gender; }
          else if (bc.type === 'device') { dim1 = r.device_platform; dim2 = r.impression_device; }
          else if (bc.type === 'placement') { dim1 = r.publisher_platform; dim2 = r.platform_position; }
          else if (bc.type === 'region') { dim1 = r.country; dim2 = r.region; }
          else if (bc.type === 'hourly') { dim1 = r.hourly_stats_aggregated_by_advertiser_time_zone; dim2 = null; }

          await this.db.query(`
            INSERT INTO insight_breakdowns (
              org_id, ad_account_id, level,
              platform_campaign_id, platform_ad_set_id, platform_ad_id,
              date, breakdown_type, dimension_1, dimension_2,
              spend, impressions, reach, clicks, inline_link_clicks, outbound_clicks,
              landing_page_views, leads, purchases, purchase_value, video_thruplay, actions_json
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
          `, [
            this.orgId, dbAccountId, dbLevel,
            r.campaign_id, r.adset_id || null, r.ad_id || null,
            r.date_start, bc.type, dim1, dim2,
            parseFloat(r.spend) || 0,
            parseInt(r.impressions) || 0,
            parseInt(r.reach) || 0,
            parseInt(r.clicks) || 0,
            parseInt(r.inline_link_clicks) || 0,
            parseInt(r.outbound_clicks?.[0]?.value) || 0,
            actions.landing_page_view || 0,
            leads, purchases, 0,
            videoMetric(r.video_thruplay_watched_actions),
            JSON.stringify(r.actions || [])
          ]);
          this.stats.breakdowns++;
        }
        console.log(`    ${rows.length} rows`);
      } catch(e) {
        console.log(`    ⚠️ ${bc.type} failed: ${e.message}`);
        this.stats.errors++;
      }
    }
  }

  /**
   * Full sync for one account: structure + insights (all levels) + breakdowns
   */
  async syncAccount(account, dateStart, dateEnd, options = {}) {
    const { skipBreakdowns = false, skipStructure = false, breakdownDaysBack = null, levels = ['campaign', 'ad_set', 'ad'] } = options;

    try {
      // Structure sync (skip if already synced today)
      if (!skipStructure) {
        const lastSync = account.last_synced_at ? new Date(account.last_synced_at) : null;
        const today = new Date().toISOString().split('T')[0];
        const lastSyncDate = lastSync ? lastSync.toISOString().split('T')[0] : null;
        
        if (lastSyncDate === today) {
          console.log(`  📂 Structure already synced today, skipping...`);
        } else {
          await this.syncStructure(account);
        }
      } else {
        await this.syncStructure(account);
      }

      // Insights at each level (full date range — catches attribution updates)
      for (const level of levels) {
        await this.syncInsights(account, level, dateStart, dateEnd);
      }

      // Breakdowns: only for recent days (yesterday by default) to save API calls
      // Full date range insights catch attribution updates, but breakdowns only need recent data
      if (!skipBreakdowns) {
        let bStart = dateStart, bEnd = dateEnd;
        if (breakdownDaysBack) {
          const d = new Date();
          d.setDate(d.getDate() - breakdownDaysBack);
          bStart = d.toISOString().split('T')[0];
        }
        await this.syncBreakdowns(account, 'ad', bStart, bEnd);
      }

      // Update last_synced_at
      await this.db.query(
        'UPDATE ad_accounts SET last_synced_at = now() WHERE id = $1',
        [account.id]
      );

    } catch(e) {
      console.log(`  ❌ Error on ${account.name}: ${e.message}`);
      this.stats.errors++;
      if (!this.stats.errorDetails) this.stats.errorDetails = [];
      this.stats.errorDetails.push({ account: account.name, accountId: account.platform_account_id, error: e.message });
    }
  }

  /**
   * Sync all accounts in the org
   */
  async syncAll(dateStart, dateEnd, options = {}) {
    const startTime = Date.now();
    const accounts = await this.getAccounts();
    console.log(`\n🚀 Starting sync for ${accounts.length} accounts (${dateStart} → ${dateEnd})\n`);

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      console.log(`\n━━━ [${i+1}/${accounts.length}] ${account.name} (${account.platform_account_id}) ━━━`);
      await this.syncAccount(account, dateStart, dateEnd, options);
      // Throttle between accounts to avoid rate limits on backfills
      if (i < accounts.length - 1) await new Promise(r => setTimeout(r, 3000));
    }

    const duration = Date.now() - startTime;

    // Log the sync
    await this.db.query(`
      INSERT INTO sync_logs (org_id, sync_type, level, date_range_start, date_range_end, records_synced, errors, error_details, duration_ms, completed_at, status)
      VALUES ($1, $2, 'all', $3, $4, $5, $6, $7, $8, now(), $9)
    `, [
      this.orgId,
      options.syncType || 'incremental',
      dateStart, dateEnd,
      this.stats.insights + this.stats.breakdowns,
      this.stats.errors,
      this.stats.errorDetails ? JSON.stringify(this.stats.errorDetails) : null,
      duration,
      this.stats.errors === 0 ? 'success' : 'partial'
    ]);

    // Refresh materialized view
    try {
      await this.db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_account_daily_summary');
      console.log('\n✅ Materialized view refreshed');
    } catch(e) {
      // First run won't have CONCURRENTLY support
      await this.db.query('REFRESH MATERIALIZED VIEW mv_account_daily_summary');
      console.log('\n✅ Materialized view refreshed');
    }

    console.log(`\n✅ Sync complete in ${(duration/1000).toFixed(1)}s`);
    console.log(`   Campaigns: ${this.stats.campaigns} | Ad Sets: ${this.stats.adSets} | Ads: ${this.stats.ads}`);
    console.log(`   Insight rows: ${this.stats.insights} | Breakdown rows: ${this.stats.breakdowns}`);
    console.log(`   Errors: ${this.stats.errors}`);

    return this.stats;
  }
}

module.exports = MetaSync;
