/**
 * Meta Marketing API wrapper
 * Handles rate limiting, pagination, retries, and timeout
 */

const https = require('https');

const API_VERSION = 'v21.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;
const REQUEST_TIMEOUT = 60000; // 60s - lesson from old bot
const RETRY_DELAYS = [15000, 30000, 60000, 120000]; // aggressive backoff for rate limits
const THROTTLE_MS = 1000; // minimum delay between API calls

function request(url, timeout = REQUEST_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout);
    https.get(url, { timeout }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        clearTimeout(timer);
        try {
          const json = JSON.parse(data);
          if (json.error) reject(new Error(`Meta API: ${json.error.message} (code ${json.error.code})`));
          else resolve(json);
        } catch(e) { reject(new Error(`Invalid JSON: ${data.slice(0, 200)}`)); }
      });
    }).on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

async function requestWithRetry(url, retries = RETRY_DELAYS) {
  for (let i = 0; i <= retries.length; i++) {
    try {
      return await request(url);
    } catch(e) {
      if (i === retries.length) throw e;
      // Retry on rate limits (code 32, 4, 17) and timeouts (code 99)
      const retryable = [4, 17, 32, 99].includes(e.code) || e.message.includes('Timeout');
      if (!retryable && !e.message.includes('temporarily')) throw e;
      console.log(`  Retry ${i+1}/${retries.length} in ${retries[i]/1000}s: ${e.message}`);
      await new Promise(r => setTimeout(r, retries[i]));
    }
  }
}

/**
 * Paginate through all results
 */
async function fetchAll(url) {
  const results = [];
  let nextUrl = url;
  while (nextUrl) {
    await new Promise(r => setTimeout(r, THROTTLE_MS)); // throttle
    const data = await requestWithRetry(nextUrl);
    if (data.data) results.push(...data.data);
    nextUrl = data.paging?.next || null;
  }
  return results;
}

/**
 * Get campaigns for an ad account (last 18 months only, non-deleted)
 */
async function getCampaigns(accountId, token) {
  const fields = 'id,name,status,objective,daily_budget,lifetime_budget,buying_type,special_ad_categories,created_time,start_time,stop_time';
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 18);
  const filtering = encodeURIComponent(JSON.stringify([
    { field: 'created_time', operator: 'GREATER_THAN', value: Math.floor(cutoff.getTime() / 1000) }
  ]));
  const url = `${BASE_URL}/act_${accountId}/campaigns?fields=${fields}&filtering=${filtering}&limit=200&access_token=${token}`;
  return fetchAll(url);
}

/**
 * Get ad sets for an ad account (last 18 months only)
 */
async function getAdSets(accountId, token) {
  // Note: targeting excluded from initial fetch (causes payload too large on big accounts)
  // Fetch targeting separately for active ad sets only if needed
  const fields = 'id,name,status,campaign_id,daily_budget,lifetime_budget,bid_strategy,optimization_goal,billing_event,attribution_setting,start_time,end_time,created_time';
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 18);
  const filtering = encodeURIComponent(JSON.stringify([
    { field: 'created_time', operator: 'GREATER_THAN', value: Math.floor(cutoff.getTime() / 1000) }
  ]));
  const url = `${BASE_URL}/act_${accountId}/adsets?fields=${fields}&filtering=${filtering}&limit=200&access_token=${token}`;
  return fetchAll(url);
}

/**
 * Get ads for an ad account (last 18 months only)
 * Fetches structure first (lightweight), creative details separately for active ads
 */
async function getAds(accountId, token, campaignIds = null) {
  const fields = 'id,name,status,effective_status,adset_id,campaign_id,created_time,lead_gen_form_id';
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 18);
  const filtering = JSON.stringify([
    { field: 'created_time', operator: 'GREATER_THAN', value: Math.floor(cutoff.getTime() / 1000) }
  ]);

  // If campaignIds provided, fetch per-campaign (fallback for large accounts)
  if (campaignIds) {
    const allAds = [];
    for (const cid of campaignIds) {
      try {
        const url = `${BASE_URL}/${cid}/ads?fields=${fields}&filtering=${encodeURIComponent(filtering)}&limit=200&access_token=${token}`;
        const ads = await fetchAll(url);
        allAds.push(...ads);
      } catch(e) {
        // Skip individual campaign failures
      }
    }
    return allAds;
  }

  const url = `${BASE_URL}/act_${accountId}/ads?fields=${fields}&filtering=${encodeURIComponent(filtering)}&limit=200&access_token=${token}`;
  return fetchAll(url);
}

/**
 * Get creative details for a batch of ad IDs
 */
async function getAdCreatives(adIds, token) {
  const results = [];
  // Use /adcreatives edge endpoint (nested creative{} syntax fails on v21.0)
  for (let i = 0; i < adIds.length; i += 50) {
    const batch = adIds.slice(i, i + 50);
    for (const adId of batch) {
      try {
        const fields = 'id,effective_object_story_id,thumbnail_url,image_url,object_story_spec,body,title,call_to_action_type';
        const url = `${BASE_URL}/${adId}/adcreatives?fields=${encodeURIComponent(fields)}&access_token=${token}`;
        const data = await requestWithRetry(url);
        const creative = data.data?.[0] || {};
        
        // Resolve image: image_url > story spec > thumbnail
        let imageUrl = creative.image_url || null;
        if (!imageUrl && creative.object_story_spec) {
          const spec = creative.object_story_spec;
          imageUrl = spec.link_data?.image_url || spec.photo_data?.url || spec.video_data?.image_url || null;
        }
        if (!imageUrl && creative.thumbnail_url) {
          imageUrl = creative.thumbnail_url;
        }

        // Resolve video
        let videoUrl = null;
        const videoId = creative.object_story_spec?.video_data?.video_id;
        if (videoId) {
          try {
            const vUrl = `${BASE_URL}/${videoId}?fields=source&access_token=${token}`;
            const vData = await requestWithRetry(vUrl);
            videoUrl = vData.source || null;
          } catch(e) { /* skip video fetch failures */ }
        }

        results.push({
          ad_id: adId,
          creative: {
            thumbnail_url: creative.thumbnail_url || null,
            image_url: imageUrl,
            video_url: videoUrl,
            title: creative.title || null,
            body: creative.body || null,
            call_to_action_type: creative.call_to_action_type || null,
            effective_object_story_id: creative.effective_object_story_id || null,
          }
        });
      } catch(e) {
        results.push({ ad_id: adId, creative: {} });
      }
    }
  }
  return results;
}

/**
 * Get insights at campaign/ad_set/ad level
 */
async function getInsights(accountId, token, level, dateStart, dateEnd) {
  const fields = [
    'campaign_id','campaign_name',
    'adset_id','adset_name',
    'ad_id','ad_name',
    'spend','impressions','reach','frequency',
    'clicks','inline_link_clicks','outbound_clicks',
    'actions','action_values','cost_per_action_type','conversions','conversion_values',
    'video_play_actions','video_p25_watched_actions','video_p50_watched_actions',
    'video_p75_watched_actions','video_p100_watched_actions','video_thruplay_watched_actions',
    'quality_ranking','engagement_rate_ranking','conversion_rate_ranking'
  ].join(',');

  const url = `${BASE_URL}/act_${accountId}/insights?fields=${fields}&level=${level}&time_range={"since":"${dateStart}","until":"${dateEnd}"}&time_increment=1&limit=500&access_token=${token}`;
  return fetchAll(url);
}

/**
 * Get breakdown insights
 */
async function getBreakdownInsights(accountId, token, level, dateStart, dateEnd, breakdowns) {
  const fields = [
    'campaign_id','adset_id','ad_id',
    'spend','impressions','reach','clicks',
    'inline_link_clicks','outbound_clicks',
    'actions','video_thruplay_watched_actions'
  ].join(',');

  const breakdownParam = Array.isArray(breakdowns) ? breakdowns.join(',') : breakdowns;
  const url = `${BASE_URL}/act_${accountId}/insights?fields=${fields}&level=${level}&breakdowns=${breakdownParam}&time_range={"since":"${dateStart}","until":"${dateEnd}"}&time_increment=1&limit=500&access_token=${token}`;
  return fetchAll(url);
}

/**
 * Get account-level info
 */
async function getAccountInfo(accountId, token) {
  const fields = 'name,account_id,account_status,currency,timezone_name,spend_cap,amount_spent,balance';
  const url = `${BASE_URL}/act_${accountId}?fields=${fields}&access_token=${token}`;
  return requestWithRetry(url);
}

module.exports = {
  getCampaigns, getAdSets, getAds, getAdCreatives,
  getInsights, getBreakdownInsights, getAccountInfo,
  API_VERSION
};
