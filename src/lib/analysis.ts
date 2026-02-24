/**
 * Pre-analysis engine for Pegasus AI
 * Computes derived insights from raw data BEFORE sending to Gemini
 * so the LLM gets patterns and signals, not just numbers
 */

interface DayData {
  date: string
  spend: number
  impressions: number
  clicks: number
  results: number
  revenue: number
  lpv: number
}

interface AdData {
  name: string
  campaign: string
  adSet: string
  spend: number
  results: number
  clicks: number
  impressions: number
  revenue: number
}

interface CampaignData {
  name: string
  spend: number
  results: number
  clicks: number
  impressions: number
  revenue: number
}

export interface PreAnalysis {
  signals: string[]
  spendHealth: string
  trendDirection: 'improving' | 'declining' | 'stable' | 'volatile' | 'inactive'
  concentrationRisk: string | null
  fatigueSignals: string[]
  wastedSpend: { total: number; details: string[] }
  scalingOpportunities: string[]
  anomalies: string[]
}

export function preAnalyze(
  thisWeek: DayData[],
  lastWeek: DayData[],
  ads: AdData[],
  campaigns: CampaignData[],
  targetCpl: number | null,
  isEcom: boolean,
  targetRoas: number | null,
): PreAnalysis {
  const signals: string[] = []
  const fatigueSignals: string[] = []
  const scalingOpportunities: string[] = []
  const anomalies: string[] = []

  // === TOTALS ===
  const tw = aggregate(thisWeek)
  const lw = aggregate(lastWeek)
  const cpr = tw.results > 0 ? tw.spend / tw.results : 0
  const lwCpr = lw.results > 0 ? lw.spend / lw.results : 0

  // === TREND ANALYSIS ===
  // Look at last 3 days vs first 3 days of current period
  const recentDays = thisWeek.slice(-3)
  const earlyDays = thisWeek.slice(0, 3)
  const recentAvg = avgCpr(recentDays)
  const earlyAvg = avgCpr(earlyDays)

  let trendDirection: PreAnalysis['trendDirection'] = 'stable'
  if (tw.spend === 0) {
    trendDirection = 'inactive'
    signals.push('CRITICAL: Account has $0 spend in this period. Campaigns may be paused, out of budget, or facing billing issues.')
  } else if (recentAvg > 0 && earlyAvg > 0) {
    const trendPct = ((recentAvg - earlyAvg) / earlyAvg) * 100
    if (trendPct > 20) {
      trendDirection = 'declining'
      signals.push(`CPR is trending UP (worse) — last 3 days avg $${recentAvg.toFixed(2)} vs first 3 days $${earlyAvg.toFixed(2)} (+${trendPct.toFixed(0)}%). Performance is deteriorating within this period.`)
    } else if (trendPct < -20) {
      trendDirection = 'improving'
      signals.push(`CPR is trending DOWN (better) — last 3 days avg $${recentAvg.toFixed(2)} vs first 3 days $${earlyAvg.toFixed(2)} (${trendPct.toFixed(0)}%). Recent optimizations may be working.`)
    }
  }

  // Day-over-day volatility
  const cprValues = thisWeek.filter(d => d.results > 0).map(d => d.spend / d.results)
  if (cprValues.length >= 3) {
    const mean = cprValues.reduce((a, b) => a + b, 0) / cprValues.length
    const variance = cprValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / cprValues.length
    const cv = Math.sqrt(variance) / mean // coefficient of variation
    if (cv > 0.5) {
      trendDirection = 'volatile'
      signals.push(`HIGH VOLATILITY: CPR swings wildly day-to-day (CV: ${(cv * 100).toFixed(0)}%). This suggests inconsistent delivery or small sample sizes. Consider whether budget is too low for reliable optimization.`)
    }
  }

  // === PERIOD-OVER-PERIOD ===
  if (lw.spend > 0 && tw.spend > 0) {
    const spendChange = ((tw.spend - lw.spend) / lw.spend) * 100
    const resultChange = lw.results > 0 ? ((tw.results - lw.results) / lw.results) * 100 : 0
    const cprChange = lwCpr > 0 && cpr > 0 ? ((cpr - lwCpr) / lwCpr) * 100 : 0

    if (spendChange > 20 && cprChange > 15) {
      signals.push(`Spend increased ${spendChange.toFixed(0)}% but CPR got ${cprChange.toFixed(0)}% worse. Scaling is hurting efficiency — the account may not support this budget level yet.`)
    } else if (spendChange > 20 && cprChange < -5) {
      signals.push(`Spend increased ${spendChange.toFixed(0)}% AND CPR improved ${Math.abs(cprChange).toFixed(0)}%. Scaling is working well — consider pushing budget further.`)
    } else if (spendChange < -20 && resultChange < -30) {
      signals.push(`Spend dropped ${Math.abs(spendChange).toFixed(0)}% and results dropped ${Math.abs(resultChange).toFixed(0)}%. Check if campaigns were paused intentionally or if this is a delivery issue.`)
    }
  }

  // === TARGET ANALYSIS ===
  if (targetCpl && cpr > 0) {
    const pctFromTarget = ((cpr - targetCpl) / targetCpl) * 100
    if (pctFromTarget > 50) {
      signals.push(`CRITICAL: CPR ($${cpr.toFixed(2)}) is ${pctFromTarget.toFixed(0)}% OVER target ($${targetCpl}). Immediate action needed — this is not sustainable.`)
    } else if (pctFromTarget > 20) {
      signals.push(`WARNING: CPR ($${cpr.toFixed(2)}) is ${pctFromTarget.toFixed(0)}% over target ($${targetCpl}). Needs optimization this week.`)
    } else if (pctFromTarget < -20) {
      signals.push(`CPR ($${cpr.toFixed(2)}) is ${Math.abs(pctFromTarget).toFixed(0)}% UNDER target ($${targetCpl}). Strong performance — room to scale or test new creative.`)
    }
  }

  if (isEcom && targetRoas && tw.spend > 0) {
    const roas = tw.revenue / tw.spend
    if (roas < targetRoas * 0.5) {
      signals.push(`CRITICAL: ROAS (${roas.toFixed(2)}x) is less than half the target (${targetRoas}x). Review audience targeting and landing page conversion.`)
    } else if (roas > targetRoas * 1.5) {
      signals.push(`ROAS (${roas.toFixed(2)}x) is ${((roas / targetRoas - 1) * 100).toFixed(0)}% above target. Strong — consider scaling spend aggressively.`)
    }
  }

  // === SPEND CONCENTRATION ===
  if (campaigns.length > 1) {
    const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0)
    const topCampaign = campaigns.sort((a, b) => b.spend - a.spend)[0]
    if (totalSpend > 0) {
      const topPct = (topCampaign.spend / totalSpend) * 100
      if (topPct > 80) {
        signals.push(`CONCENTRATION RISK: ${topPct.toFixed(0)}% of spend is in one campaign ("${topCampaign.name}"). If this campaign fatigues, the entire account suffers. Diversify.`)
      }
    }
  }

  let concentrationRisk: string | null = null
  if (ads.length > 0) {
    const totalAdSpend = ads.reduce((s, a) => s + a.spend, 0)
    const topAd = ads.sort((a, b) => b.spend - a.spend)[0]
    if (totalAdSpend > 0) {
      const topAdPct = (topAd.spend / totalAdSpend) * 100
      if (topAdPct > 60) {
        concentrationRisk = `${topAdPct.toFixed(0)}% of ad spend is concentrated in "${topAd.name}". High single-ad dependency.`
      }
    }
  }

  // === WASTED SPEND ===
  const wastedAds = ads.filter(a => a.results === 0 && a.spend > (targetCpl || 30) * 0.5)
  const totalWasted = wastedAds.reduce((s, a) => s + a.spend, 0)
  const wastedDetails = wastedAds
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5)
    .map(a => `"${a.name}": $${a.spend.toFixed(0)} spent, 0 results (${a.campaign})`)

  if (totalWasted > tw.spend * 0.15 && totalWasted > 50) {
    signals.push(`${((totalWasted / tw.spend) * 100).toFixed(0)}% of total spend ($${totalWasted.toFixed(0)}) went to non-converting ads. Review and pause underperformers.`)
  }

  // === SCALING OPPORTUNITIES ===
  const efficientAds = ads
    .filter(a => a.results >= 3 && (targetCpl ? a.spend / a.results < targetCpl * 0.8 : true))
    .sort((a, b) => (a.spend / a.results) - (b.spend / b.results))

  for (const ad of efficientAds.slice(0, 3)) {
    const adCpr = ad.spend / ad.results
    scalingOpportunities.push(`"${ad.name}" — $${adCpr.toFixed(2)} CPR with ${ad.results} results. Well under target. Can this ad set get more budget?`)
  }

  // Campaigns with room to scale
  for (const camp of campaigns.filter(c => c.results >= 5)) {
    const campCpr = camp.spend / camp.results
    if (targetCpl && campCpr < targetCpl * 0.7) {
      scalingOpportunities.push(`Campaign "${camp.name}" is at $${campCpr.toFixed(2)} CPR (${((1 - campCpr / targetCpl) * 100).toFixed(0)}% under target). Scale budget here.`)
    }
  }

  // === ZERO-RESULT DAYS ===
  const zeroResultDays = thisWeek.filter(d => d.spend > 20 && d.results === 0)
  if (zeroResultDays.length > 0) {
    anomalies.push(`${zeroResultDays.length} day(s) with $20+ spend but ZERO results: ${zeroResultDays.map(d => d.date).join(', ')}. Check tracking and landing pages.`)
  }

  // === CTR ANALYSIS ===
  const ctr = tw.impressions > 0 ? (tw.clicks / tw.impressions) * 100 : 0
  const lwCtr = lw.impressions > 0 ? (lw.clicks / lw.impressions) * 100 : 0
  if (ctr < 1.0 && tw.impressions > 1000) {
    signals.push(`CTR is ${ctr.toFixed(2)}% — below the 1% benchmark. Creative may not be resonating with the audience. Test new hooks and visuals.`)
  }
  if (lwCtr > 0 && ctr > 0 && ((ctr - lwCtr) / lwCtr * 100) < -25) {
    fatigueSignals.push(`CTR dropped ${Math.abs(((ctr - lwCtr) / lwCtr * 100)).toFixed(0)}% vs last period (${lwCtr.toFixed(2)}% → ${ctr.toFixed(2)}%). Audience may be fatiguing on current creative.`)
  }

  // === CONVERSION RATE ===
  const convRate = tw.clicks > 0 ? (tw.results / tw.clicks) * 100 : 0
  if (convRate < 2 && tw.clicks > 100) {
    signals.push(`Conversion rate is ${convRate.toFixed(2)}% (${tw.results} results from ${tw.clicks} clicks). Landing page or offer may need work.`)
  }

  // === SPEND HEALTH ===
  let spendHealth = 'normal'
  if (tw.spend === 0) spendHealth = 'Account is not spending.'
  else if (targetCpl && cpr > targetCpl * 1.5) spendHealth = 'Over target — optimize before scaling.'
  else if (targetCpl && cpr <= targetCpl) spendHealth = 'On or under target — healthy.'
  else spendHealth = 'Moderate — monitor trends.'

  return {
    signals,
    spendHealth,
    trendDirection,
    concentrationRisk,
    fatigueSignals,
    wastedSpend: { total: totalWasted, details: wastedDetails },
    scalingOpportunities,
    anomalies,
  }
}

// Analyze audience efficiency for targeting recommendations
export function analyzeAudience(
  ageData: Record<string, { spend: number; results: number }>,
  targetCpl: number | null,
): string[] {
  const signals: string[] = []
  const entries = Object.entries(ageData).filter(([, d]) => d.spend > 0)
  if (entries.length < 2) return signals

  const totalSpend = entries.reduce((s, [, d]) => s + d.spend, 0)
  const totalResults = entries.reduce((s, [, d]) => s + d.results, 0)
  if (totalSpend === 0 || totalResults === 0) return signals

  const avgCpr = totalSpend / totalResults

  // Find best and worst performing age groups
  const withResults = entries.filter(([, d]) => d.results > 0).map(([name, d]) => ({
    name, cpr: d.spend / d.results, spend: d.spend, results: d.results, pct: d.spend / totalSpend * 100,
  }))

  const noResults = entries.filter(([, d]) => d.results === 0 && d.spend > avgCpr * 0.5).map(([name, d]) => ({
    name, spend: d.spend, pct: d.spend / totalSpend * 100,
  }))

  if (withResults.length > 0) {
    const best = withResults.sort((a, b) => a.cpr - b.cpr)[0]
    const worst = withResults.sort((a, b) => b.cpr - a.cpr)[0]
    if (best.cpr < worst.cpr * 0.5 && withResults.length > 2) {
      signals.push(`Age "${best.name}" converts at $${best.cpr.toFixed(2)} CPR vs "${worst.name}" at $${worst.cpr.toFixed(2)}. Consider shifting budget toward ${best.name}.`)
    }
  }

  if (noResults.length > 0) {
    const wastedPct = noResults.reduce((s, n) => s + n.pct, 0)
    if (wastedPct > 10) {
      signals.push(`${wastedPct.toFixed(0)}% of spend goes to age groups with 0 results: ${noResults.map(n => n.name).join(', ')}. Consider excluding or reducing.`)
    }
  }

  return signals
}

function aggregate(days: DayData[]) {
  return days.reduce((s, d) => ({
    spend: s.spend + d.spend,
    impressions: s.impressions + d.impressions,
    clicks: s.clicks + d.clicks,
    results: s.results + d.results,
    revenue: s.revenue + d.revenue,
  }), { spend: 0, impressions: 0, clicks: 0, results: 0, revenue: 0 })
}

function avgCpr(days: DayData[]): number {
  const withResults = days.filter(d => d.results > 0)
  if (withResults.length === 0) return 0
  const totalSpend = withResults.reduce((s, d) => s + d.spend, 0)
  const totalResults = withResults.reduce((s, d) => s + d.results, 0)
  return totalResults > 0 ? totalSpend / totalResults : 0
}
