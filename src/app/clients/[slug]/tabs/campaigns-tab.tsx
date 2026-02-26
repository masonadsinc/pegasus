'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import { AdImage } from './shared'

interface CampaignsTabProps {
  campaigns: any[]
  adSets: any[]
  ads: any[]
  resultLabel: string
  targetCpl: number | null
  onSelectAd: (ad: any) => void
}

export function CampaignsTab({ campaigns, adSets, ads, resultLabel, targetCpl, onSelectAd }: CampaignsTabProps) {
  const [drillLevel, setDrillLevel] = useState<'campaigns' | 'adsets' | 'ads'>('campaigns')
  const [drillCampaignId, setDrillCampaignId] = useState<string | null>(null)
  const [drillAdSetId, setDrillAdSetId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[12px]">
        <button onClick={() => { setDrillLevel('campaigns'); setDrillCampaignId(null); setDrillAdSetId(null) }} className={`font-medium transition-colors ${drillLevel === 'campaigns' ? 'text-[#111113]' : 'text-[#2563eb] hover:underline'}`}>
          Campaigns ({campaigns.length})
        </button>
        {drillCampaignId && (<>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="#9d9da8"><path d="M7 4l6 6-6 6" /></svg>
          <button onClick={() => { setDrillLevel('adsets'); setDrillAdSetId(null) }} className={`font-medium truncate max-w-[200px] transition-colors ${drillLevel === 'adsets' ? 'text-[#111113]' : 'text-[#2563eb] hover:underline'}`}>
            {campaigns.find((c: any) => c.platform_campaign_id === drillCampaignId)?.campaign_name || 'Ad Sets'}
          </button>
        </>)}
        {drillAdSetId && (<>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="#9d9da8"><path d="M7 4l6 6-6 6" /></svg>
          <span className="font-medium text-[#111113] truncate max-w-[200px]">
            {adSets.find((a: any) => a.platform_ad_set_id === drillAdSetId)?.ad_set_name || 'Ads'}
          </span>
        </>)}
      </div>

      {/* Campaign Level */}
      {drillLevel === 'campaigns' && (
        <Card>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-[#e8e8ec]">
                <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-left uppercase tracking-wider">Campaign</th>
                <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Spend</th>
                <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">{resultLabel}</th>
                <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CPR</th>
                <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CTR</th>
                <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Ad Sets</th>
                <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Ads</th>
              </tr></thead>
              <tbody>
                {campaigns.map((c: any) => {
                  const campAdSets = adSets.filter((a: any) => a.platform_campaign_id === c.platform_campaign_id)
                  const campAds = ads.filter((a: any) => a.platform_campaign_id === c.platform_campaign_id)
                  const isOver = targetCpl && c.cpr > 0 ? c.cpr > targetCpl : false
                  return (
                    <tr key={c.platform_campaign_id} className="border-b border-[#f4f4f6] hover:bg-[#fafafb] cursor-pointer transition-colors" onClick={() => { setDrillLevel('adsets'); setDrillCampaignId(c.platform_campaign_id) }}>
                      <td className="py-3 px-4"><p className="font-medium text-[#2563eb] hover:underline">{c.campaign_name}</p></td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium">{formatCurrency(c.spend)}</td>
                      <td className="py-3 px-4 text-right tabular-nums">{formatNumber(c.results)}</td>
                      <td className={`py-3 px-4 text-right tabular-nums font-semibold ${isOver ? 'text-[#dc2626]' : c.cpr > 0 ? 'text-[#16a34a]' : 'text-[#9d9da8]'}`}>{c.cpr > 0 ? formatCurrency(c.cpr) : '—'}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-[#6b6b76]">{formatPercent(c.ctr)}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-[#9d9da8]">{campAdSets.length}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-[#9d9da8]">{campAds.length}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Ad Set Level */}
      {drillLevel === 'adsets' && drillCampaignId && (() => {
        const campAdSets = adSets.filter((a: any) => a.platform_campaign_id === drillCampaignId)
        return (
          <Card>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-[#e8e8ec]">
                  <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-left uppercase tracking-wider">Ad Set</th>
                  <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-left uppercase tracking-wider">Status</th>
                  <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Budget</th>
                  <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Spend</th>
                  <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">{resultLabel}</th>
                  <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CPR</th>
                  <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">CTR</th>
                  <th className="py-3 px-4 text-[11px] text-[#9d9da8] font-medium text-right uppercase tracking-wider">Ads</th>
                </tr></thead>
                <tbody>
                  {campAdSets.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-[#9d9da8] text-[13px]">No ad set data available</td></tr>}
                  {campAdSets.map((as: any) => {
                    const asAds = ads.filter((a: any) => a.platform_campaign_id === drillCampaignId)
                    const isOver = targetCpl && as.cpr > 0 ? as.cpr > targetCpl : false
                    return (
                      <tr key={as.platform_ad_set_id} className="border-b border-[#f4f4f6] hover:bg-[#fafafb] cursor-pointer transition-colors" onClick={() => { setDrillLevel('ads'); setDrillAdSetId(as.platform_ad_set_id) }}>
                        <td className="py-3 px-4"><p className="font-medium text-[#2563eb] hover:underline">{as.ad_set_name}</p>{as.optimization_goal && <p className="text-[10px] text-[#9d9da8] mt-0.5">{as.optimization_goal.replace(/_/g, ' ').toLowerCase()}</p>}</td>
                        <td className="py-3 px-4"><Badge variant={as.status === 'ACTIVE' ? 'success' : 'neutral'}>{(as.status || 'unknown').toLowerCase()}</Badge></td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#6b6b76]">{as.daily_budget ? `${formatCurrency(as.daily_budget)}/day` : '—'}</td>
                        <td className="py-3 px-4 text-right tabular-nums font-medium">{formatCurrency(as.spend)}</td>
                        <td className="py-3 px-4 text-right tabular-nums">{formatNumber(as.results)}</td>
                        <td className={`py-3 px-4 text-right tabular-nums font-semibold ${isOver ? 'text-[#dc2626]' : as.cpr > 0 ? 'text-[#16a34a]' : 'text-[#9d9da8]'}`}>{as.cpr > 0 ? formatCurrency(as.cpr) : '—'}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#6b6b76]">{formatPercent(as.ctr)}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#9d9da8]">{asAds.length}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      })()}

      {/* Ad Level */}
      {drillLevel === 'ads' && drillAdSetId && (() => {
        const drillAds = ads.filter((a: any) => a.platform_campaign_id === drillCampaignId)
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {drillAds.length === 0 && <p className="text-[13px] text-[#9d9da8] col-span-3 text-center py-8">No ads found</p>}
            {drillAds.map((ad: any) => {
              const imageUrl = ad.creative_url || ad.creative_thumbnail_url
              return (
                <Card key={ad.platform_ad_id} className="overflow-hidden cursor-pointer hover:shadow-md hover:border-[#c4c4cc] transition-all" onClick={() => onSelectAd(ad)}>
                  <AdImage src={imageUrl} alt={ad.ad_name} className="w-full h-[160px]" />
                  <div className="p-3">
                    <p className="text-[12px] font-medium truncate mb-2">{ad.ad_name}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                      <div><span className="text-[#9d9da8]">Spend</span><p className="font-semibold tabular-nums">{formatCurrency(ad.spend)}</p></div>
                      <div><span className="text-[#9d9da8]">{resultLabel}</span><p className="font-semibold tabular-nums">{ad.results}</p></div>
                      <div><span className="text-[#9d9da8]">CPR</span><p className={`font-semibold tabular-nums ${ad.cpr > 0 ? (targetCpl && ad.cpr > targetCpl ? 'text-[#dc2626]' : 'text-[#16a34a]') : 'text-[#c4c4cc]'}`}>{ad.cpr > 0 ? formatCurrency(ad.cpr) : '—'}</p></div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )
      })()}
    </div>
  )
}
