'use client'

interface PortalProps {
  clientName: string
  industry: string | null
  isEcom: boolean
  resultLabel: string
  targetCpl: number | null
  targetRoas: number | null
  current: { spend: number; impressions: number; clicks: number; results: number; revenue: number }
  previous: { spend: number; impressions: number; clicks: number; results: number; revenue: number }
  campaigns: { name: string; spend: number; results: number; clicks: number; impressions: number; revenue: number; cpr: number; ctr: number }[]
  topAds: { name: string; imageUrl: string | null; headline: string | null; spend: number; results: number; cpr: number; ctr: number }[]
  daily: { date: string; spend: number; results: number }[]
  lastUpdated: string
}

function pctChange(current: number, previous: number): string {
  if (previous === 0) return 'N/A'
  const pct = ((current - previous) / previous * 100).toFixed(1)
  return `${Number(pct) > 0 ? '+' : ''}${pct}%`
}

function ChangeIndicator({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  if (previous === 0) return <span className="text-[10px] text-[#9d9da8]">--</span>
  const pct = ((current - previous) / previous * 100)
  const isGood = invert ? pct < 0 : pct > 0
  return (
    <span className={`text-[10px] font-semibold ${isGood ? 'text-[#16a34a]' : pct === 0 ? 'text-[#9d9da8]' : 'text-[#dc2626]'}`}>
      {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function PortalDashboard({ clientName, industry, isEcom, resultLabel, targetCpl, targetRoas, current, previous, campaigns, topAds, daily, lastUpdated }: PortalProps) {
  const cpr = current.results > 0 ? current.spend / current.results : 0
  const prevCpr = previous.results > 0 ? previous.spend / previous.results : 0
  const ctr = current.impressions > 0 ? (current.clicks / current.impressions * 100) : 0
  const roas = current.spend > 0 ? current.revenue / current.spend : 0

  // Chart dimensions
  const maxSpend = Math.max(...daily.map(d => d.spend), 1)
  const maxResults = Math.max(...daily.map(d => d.results), 1)

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <div className="bg-white border-b border-[#e8e8ec]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-semibold text-[#111113]">{clientName}</h1>
            {industry && <p className="text-[12px] text-[#9d9da8] mt-0.5">{industry}</p>}
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-semibold">Last 30 Days</p>
            <p className="text-[11px] text-[#9d9da8]">Updated {formatDate(lastUpdated)}</p>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-[#e8e8ec] rounded p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-semibold">Spend</p>
            <p className="text-[24px] font-semibold text-[#111113] mt-1">${current.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <ChangeIndicator current={current.spend} previous={previous.spend} />
            <span className="text-[10px] text-[#9d9da8] ml-1">vs prev 30d</span>
          </div>
          <div className="bg-white border border-[#e8e8ec] rounded p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-semibold">{resultLabel}</p>
            <p className="text-[24px] font-semibold text-[#111113] mt-1">{current.results.toLocaleString()}</p>
            <ChangeIndicator current={current.results} previous={previous.results} />
            <span className="text-[10px] text-[#9d9da8] ml-1">vs prev 30d</span>
          </div>
          <div className="bg-white border border-[#e8e8ec] rounded p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-semibold">{isEcom ? 'ROAS' : 'Cost Per Result'}</p>
            <p className="text-[24px] font-semibold text-[#111113] mt-1">
              {isEcom ? `${roas.toFixed(2)}x` : `$${cpr.toFixed(2)}`}
            </p>
            {!isEcom && <ChangeIndicator current={cpr} previous={prevCpr} invert />}
            {isEcom && <ChangeIndicator current={roas} previous={previous.spend > 0 ? previous.revenue / previous.spend : 0} />}
            <span className="text-[10px] text-[#9d9da8] ml-1">vs prev 30d</span>
            {targetCpl && !isEcom && (
              <p className="text-[10px] text-[#9d9da8] mt-1">Target: ${targetCpl}</p>
            )}
          </div>
          <div className="bg-white border border-[#e8e8ec] rounded p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-semibold">{isEcom ? 'Revenue' : 'CTR'}</p>
            <p className="text-[24px] font-semibold text-[#111113] mt-1">
              {isEcom ? `$${current.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `${ctr.toFixed(2)}%`}
            </p>
            {isEcom
              ? <ChangeIndicator current={current.revenue} previous={previous.revenue} />
              : <ChangeIndicator current={ctr} previous={previous.impressions > 0 ? (previous.clicks / previous.impressions * 100) : 0} />
            }
            <span className="text-[10px] text-[#9d9da8] ml-1">vs prev 30d</span>
          </div>
        </div>

        {/* Daily Chart */}
        {daily.length > 0 && (
          <div className="bg-white border border-[#e8e8ec] rounded p-4">
            <h2 className="text-[13px] font-semibold text-[#111113] mb-4">Daily Performance</h2>
            <div className="flex items-end gap-[2px] h-32">
              {daily.map((d, i) => {
                const spendHeight = (d.spend / maxSpend) * 100
                const resultHeight = maxResults > 0 ? (d.results / maxResults) * 100 : 0
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-[#111113] text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                      {formatDate(d.date)}: ${d.spend.toFixed(0)} / {d.results} {resultLabel.toLowerCase()}
                    </div>
                    <div className="w-full flex items-end gap-[1px]" style={{ height: '100%' }}>
                      <div
                        className="flex-1 bg-[#2563eb]/20 rounded-t-sm transition-all group-hover:bg-[#2563eb]/40"
                        style={{ height: `${spendHeight}%`, minHeight: d.spend > 0 ? '2px' : '0' }}
                      />
                      <div
                        className="flex-1 bg-[#16a34a]/40 rounded-t-sm transition-all group-hover:bg-[#16a34a]/60"
                        style={{ height: `${resultHeight}%`, minHeight: d.results > 0 ? '2px' : '0' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[9px] text-[#9d9da8]">{formatDate(daily[0].date)}</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 text-[9px] text-[#9d9da8]">
                  <span className="w-2 h-2 rounded-sm bg-[#2563eb]/30" /> Spend
                </span>
                <span className="flex items-center gap-1 text-[9px] text-[#9d9da8]">
                  <span className="w-2 h-2 rounded-sm bg-[#16a34a]/50" /> {resultLabel}
                </span>
              </div>
              <span className="text-[9px] text-[#9d9da8]">{formatDate(daily[daily.length - 1].date)}</span>
            </div>
          </div>
        )}

        {/* Two columns: Campaigns + Top Ads */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Campaigns */}
          <div className="bg-white border border-[#e8e8ec] rounded">
            <div className="px-4 py-3 border-b border-[#e8e8ec]">
              <h2 className="text-[13px] font-semibold text-[#111113]">Campaigns</h2>
            </div>
            <div className="divide-y divide-[#e8e8ec]">
              {campaigns.slice(0, 8).map((c, i) => (
                <div key={i} className="px-4 py-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-[12px] font-semibold text-[#111113] truncate">{c.name}</p>
                    <p className="text-[10px] text-[#9d9da8]">
                      {c.impressions.toLocaleString()} imp &middot; {c.clicks.toLocaleString()} clicks &middot; {c.ctr.toFixed(2)}% CTR
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[12px] font-semibold text-[#111113]">{c.results} {resultLabel.toLowerCase()}</p>
                    <p className="text-[10px] text-[#9d9da8]">
                      ${c.spend.toFixed(0)} spent {c.results > 0 ? `· $${c.cpr.toFixed(2)} CPR` : ''}
                    </p>
                  </div>
                </div>
              ))}
              {campaigns.length === 0 && (
                <div className="px-4 py-6 text-center text-[12px] text-[#9d9da8]">No campaign data</div>
              )}
            </div>
          </div>

          {/* Top Ads */}
          <div className="bg-white border border-[#e8e8ec] rounded">
            <div className="px-4 py-3 border-b border-[#e8e8ec]">
              <h2 className="text-[13px] font-semibold text-[#111113]">Top Performing Ads</h2>
            </div>
            <div className="divide-y divide-[#e8e8ec]">
              {topAds.map((ad, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3">
                  {ad.imageUrl && (
                    <img src={ad.imageUrl} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0 bg-[#f8f8fa]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-[#111113] truncate">{ad.name}</p>
                    {ad.headline && <p className="text-[10px] text-[#9d9da8] truncate">{ad.headline}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[12px] font-semibold text-[#111113]">${ad.cpr.toFixed(2)} CPR</p>
                    <p className="text-[10px] text-[#9d9da8]">{ad.results} results &middot; ${ad.spend.toFixed(0)}</p>
                  </div>
                </div>
              ))}
              {topAds.length === 0 && (
                <div className="px-4 py-6 text-center text-[12px] text-[#9d9da8]">No top performers this period</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-[10px] text-[#9d9da8]">Powered by Ads.Inc &middot; Data through {formatDate(lastUpdated)}</p>
        </div>
      </div>
    </div>
  )
}
