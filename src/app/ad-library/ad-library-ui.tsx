'use client'

import { useState, useEffect, useCallback } from 'react'

interface Client {
  id: string
  name: string
  slug: string
}

interface LiveAd {
  id: string
  platform_ad_id: string
  name: string
  status: string
  creative_url: string
  creative_thumbnail_url: string | null
  creative_video_url: string | null
  creative_headline: string | null
  creative_body: string | null
  creative_cta: string | null
  clientName: string
  clientSlug: string
  clientId: string
  spend: number
  results: number
  cpr: number
  ctr: number
  isVideo: boolean
}

interface GeneratedCreative {
  id: string
  client_id: string
  concept: string | null
  aspect_ratio: string | null
  model: string | null
  status: string
  metadata: any
  created_at: string
  pipeline_status: string
  pipeline_notes: string | null
  pipeline_updated_at: string | null
  source: string | null
  clientName: string
  clientSlug: string
  hasImage: boolean
}

const PIPELINE_STAGES = [
  { key: 'needs_review', label: 'Needs Review', color: '#f59e0b', bg: '#fef3c7' },
  { key: 'client_review', label: 'Client Review', color: '#2563eb', bg: '#dbeafe' },
  { key: 'approved', label: 'Approved', color: '#16a34a', bg: '#dcfce7' },
  { key: 'live', label: 'Live', color: '#111113', bg: '#f4f4f6' },
  { key: 'not_used', label: 'Not Used', color: '#9d9da8', bg: '#f4f4f6' },
] as const

type PipelineStatus = typeof PIPELINE_STAGES[number]['key']

function fmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toFixed(n < 10 ? 2 : 0)
}

export function AdLibraryUI({ clients }: { clients: Client[] }) {
  const [activeTab, setActiveTab] = useState<'live' | 'generated'>('live')
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [liveAds, setLiveAds] = useState<LiveAd[]>([])
  const [generated, setGenerated] = useState<GeneratedCreative[]>([])
  const [pipelineCounts, setPipelineCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [selectedAd, setSelectedAd] = useState<LiveAd | null>(null)
  const [selectedCreative, setSelectedCreative] = useState<GeneratedCreative | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ tab: activeTab })
      if (selectedClient) params.set('clientId', selectedClient)
      if (activeTab === 'generated' && filterStatus !== 'all') params.set('status', filterStatus)

      const res = await fetch(`/api/ad-library?${params}`)
      const data = await res.json()

      if (activeTab === 'live') {
        setLiveAds(data.ads || [])
      } else {
        setGenerated(data.creatives || [])
        setPipelineCounts(data.pipelineCounts || {})
      }
    } catch {}
    setLoading(false)
  }, [activeTab, selectedClient, filterStatus])

  useEffect(() => { fetchData() }, [fetchData])

  const updatePipelineStatus = useCallback(async (id: string, newStatus: PipelineStatus) => {
    setUpdatingStatus(id)
    try {
      await fetch('/api/ad-library', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, pipeline_status: newStatus }),
      })
      // Update local state
      setGenerated(prev => prev.map(c => c.id === id ? { ...c, pipeline_status: newStatus } : c))
      setPipelineCounts(prev => {
        const oldStatus = generated.find(c => c.id === id)?.pipeline_status || 'needs_review'
        return {
          ...prev,
          [oldStatus]: Math.max(0, (prev[oldStatus] || 0) - 1),
          [newStatus]: (prev[newStatus] || 0) + 1,
        }
      })
    } catch {}
    setUpdatingStatus(null)
  }, [generated])

  const totalGenerated = Object.values(pipelineCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="p-4 sm:p-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[20px] font-semibold text-[#111113] tracking-tight">Ad Library</h1>
          <p className="text-[12px] text-[#9d9da8] mt-0.5">All creative assets across clients — live ads and generated creatives</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setActiveTab('live')} className={`px-3 py-1.5 text-[12px] font-medium rounded transition-colors ${activeTab === 'live' ? 'bg-[#111113] text-white' : 'text-[#6b6b76] hover:bg-[#f4f4f6]'}`}>
            Live Ads
          </button>
          <button onClick={() => setActiveTab('generated')} className={`px-3 py-1.5 text-[12px] font-medium rounded transition-colors ${activeTab === 'generated' ? 'bg-[#111113] text-white' : 'text-[#6b6b76] hover:bg-[#f4f4f6]'}`}>
            Generated ({totalGenerated})
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#e8e8ec] rounded-md p-4 mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="w-full sm:w-auto">
            <label className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-medium mb-1 block">Client</label>
            <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="w-full sm:w-[200px] px-3 py-2 text-[13px] bg-[#f4f4f6] border border-[#e8e8ec] rounded focus:outline-none focus:border-[#2563eb] focus:bg-white">
              <option value="">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Pipeline filter (generated tab only) */}
          {activeTab === 'generated' && (
            <div className="flex items-end gap-1 flex-wrap">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-medium mb-1 block">Pipeline Status</label>
                <div className="flex gap-1 flex-wrap">
                  <button onClick={() => setFilterStatus('all')} className={`px-2.5 py-1.5 text-[11px] font-medium rounded transition-colors ${filterStatus === 'all' ? 'bg-[#111113] text-white' : 'bg-[#f4f4f6] text-[#6b6b76] hover:bg-[#e8e8ec]'}`}>
                    All ({totalGenerated})
                  </button>
                  {PIPELINE_STAGES.map(stage => (
                    <button key={stage.key} onClick={() => setFilterStatus(stage.key)} className={`px-2.5 py-1.5 text-[11px] font-medium rounded transition-colors ${filterStatus === stage.key ? `text-white` : `text-[#6b6b76] hover:bg-[#e8e8ec]`}`} style={filterStatus === stage.key ? { backgroundColor: stage.color } : { backgroundColor: '#f4f4f6' }}>
                      {stage.label} ({pipelineCounts[stage.key] || 0})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white border border-[#e8e8ec] rounded-md p-12 text-center">
          <svg className="animate-spin w-6 h-6 text-[#9d9da8] mx-auto mb-2" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".3" /><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
          <p className="text-[12px] text-[#9d9da8]">Loading...</p>
        </div>
      )}

      {/* LIVE ADS TAB */}
      {!loading && activeTab === 'live' && (
        <>
          {liveAds.length === 0 ? (
            <div className="bg-white border border-[#e8e8ec] rounded-md p-12 text-center">
              <p className="text-[13px] text-[#6b6b76]">No live ads found{selectedClient ? ' for this client' : ''}</p>
            </div>
          ) : (
            <>
              <p className="text-[11px] text-[#9d9da8] mb-3">{liveAds.length} active ad{liveAds.length !== 1 ? 's' : ''} with creatives (30d performance)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {liveAds.map(ad => (
                  <div key={ad.id} onClick={() => setSelectedAd(ad)} className="bg-white border border-[#e8e8ec] rounded-md overflow-hidden cursor-pointer hover:border-[#2563eb] hover:shadow-sm transition-all group">
                    <div className="relative aspect-square bg-[#f4f4f6]">
                      <img src={ad.creative_url} alt={ad.name} className="w-full h-full object-cover" loading="lazy" />
                      {ad.isVideo && (
                        <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded">VIDEO</div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] text-white/80 truncate">{ad.clientName}</p>
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="text-[11px] font-medium text-[#111113] truncate">{ad.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {ad.spend > 0 && <span className="text-[10px] text-[#6b6b76]">${fmt(ad.spend)}</span>}
                        {ad.results > 0 && <span className="text-[10px] text-[#16a34a]">{ad.results} res</span>}
                        {ad.cpr > 0 && <span className="text-[10px] text-[#2563eb]">${ad.cpr.toFixed(2)}</span>}
                      </div>
                      {!selectedClient && <p className="text-[9px] text-[#9d9da8] mt-0.5 truncate">{ad.clientName}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* GENERATED CREATIVES TAB */}
      {!loading && activeTab === 'generated' && (
        <>
          {generated.length === 0 ? (
            <div className="bg-white border border-[#e8e8ec] rounded-md p-12 text-center">
              <p className="text-[13px] text-[#6b6b76]">No generated creatives{selectedClient ? ' for this client' : ''}{filterStatus !== 'all' ? ` with status "${PIPELINE_STAGES.find(s => s.key === filterStatus)?.label}"` : ''}</p>
              <p className="text-[11px] text-[#9d9da8] mt-1">Generate creatives from the Creative Studio or Copywriter</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {generated.map(creative => {
                const stage = PIPELINE_STAGES.find(s => s.key === creative.pipeline_status) || PIPELINE_STAGES[0]
                return (
                  <div key={creative.id} className="bg-white border border-[#e8e8ec] rounded-md overflow-hidden group">
                    {/* Image */}
                    <div className="relative aspect-square bg-[#f4f4f6]" onClick={() => setSelectedCreative(creative)}>
                      {creative.hasImage ? (
                        <img src={`/api/ad-library/image?id=${creative.id}`} alt={creative.concept || 'Generated'} className="w-full h-full object-cover cursor-pointer" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <p className="text-[11px] text-[#9d9da8]">No image</p>
                        </div>
                      )}
                      {/* QA badge */}
                      {creative.status === 'qa_warning' && (
                        <div className="absolute top-1.5 right-1.5 bg-[#dc2626] text-white text-[9px] font-semibold px-1.5 py-0.5 rounded">QA FAIL</div>
                      )}
                      {/* Source badge */}
                      <div className="absolute top-1.5 left-1.5 bg-black/50 text-white text-[9px] font-medium px-1.5 py-0.5 rounded">
                        {creative.source === 'copywriter' ? 'COPY' : 'STUDIO'}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-2">
                      <p className="text-[11px] font-medium text-[#111113] truncate">{creative.concept || 'Untitled'}</p>
                      <p className="text-[9px] text-[#9d9da8] mt-0.5">{creative.clientName} — {new Date(creative.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>

                      {/* Pipeline status selector */}
                      <div className="mt-2">
                        <select
                          value={creative.pipeline_status}
                          onChange={e => updatePipelineStatus(creative.id, e.target.value as PipelineStatus)}
                          disabled={updatingStatus === creative.id}
                          className="w-full text-[10px] font-semibold px-2 py-1 rounded border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                          style={{ backgroundColor: stage.bg, color: stage.color }}
                        >
                          {PIPELINE_STAGES.map(s => (
                            <option key={s.key} value={s.key}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* LIVE AD DETAIL MODAL */}
      {selectedAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedAd(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-md shadow-xl max-w-[900px] w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedAd(null)} className="absolute top-3 right-3 z-10 w-7 h-7 rounded bg-black/10 hover:bg-black/20 flex items-center justify-center transition-colors">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#111113" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
            </button>
            <div className="flex flex-col md:flex-row">
              {/* Image */}
              <div className="md:w-[45%] bg-[#f4f4f6] flex items-center justify-center min-h-[300px]">
                <img src={selectedAd.creative_url} alt={selectedAd.name} className="w-full h-full object-contain" />
              </div>
              {/* Details */}
              <div className="md:w-[55%] p-5">
                <p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-medium">{selectedAd.clientName}</p>
                <h3 className="text-[16px] font-semibold text-[#111113] mt-1">{selectedAd.name}</h3>

                <div className="grid grid-cols-4 gap-3 mt-4">
                  <div className="bg-[#f9f9fb] rounded p-2.5 text-center">
                    <p className="text-[10px] text-[#9d9da8] uppercase tracking-wider">Spend</p>
                    <p className="text-[16px] font-semibold text-[#111113]">${fmt(selectedAd.spend)}</p>
                  </div>
                  <div className="bg-[#f9f9fb] rounded p-2.5 text-center">
                    <p className="text-[10px] text-[#9d9da8] uppercase tracking-wider">Results</p>
                    <p className="text-[16px] font-semibold text-[#16a34a]">{selectedAd.results}</p>
                  </div>
                  <div className="bg-[#f9f9fb] rounded p-2.5 text-center">
                    <p className="text-[10px] text-[#9d9da8] uppercase tracking-wider">CPR</p>
                    <p className="text-[16px] font-semibold text-[#2563eb]">${selectedAd.cpr > 0 ? selectedAd.cpr.toFixed(2) : '--'}</p>
                  </div>
                  <div className="bg-[#f9f9fb] rounded p-2.5 text-center">
                    <p className="text-[10px] text-[#9d9da8] uppercase tracking-wider">CTR</p>
                    <p className="text-[16px] font-semibold text-[#111113]">{selectedAd.ctr > 0 ? selectedAd.ctr.toFixed(2) + '%' : '--'}</p>
                  </div>
                </div>

                {selectedAd.creative_headline && (
                  <div className="mt-4">
                    <p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-medium">Headline</p>
                    <p className="text-[13px] text-[#111113] mt-0.5">{selectedAd.creative_headline}</p>
                  </div>
                )}
                {selectedAd.creative_body && (
                  <div className="mt-3">
                    <p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-medium">Primary Text</p>
                    <p className="text-[12px] text-[#3a3a44] mt-0.5 whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto">{selectedAd.creative_body}</p>
                  </div>
                )}
                {selectedAd.creative_cta && (
                  <div className="mt-3">
                    <p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-medium">CTA</p>
                    <p className="text-[12px] text-[#111113] mt-0.5">{selectedAd.creative_cta}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#e8e8ec]">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${selectedAd.isVideo ? 'bg-[#dbeafe] text-[#2563eb]' : 'bg-[#f4f4f6] text-[#6b6b76]'}`}>
                    {selectedAd.isVideo ? 'Video' : 'Image'}
                  </span>
                  <span className="text-[10px] text-[#9d9da8]">ID: {selectedAd.platform_ad_id}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GENERATED CREATIVE DETAIL MODAL */}
      {selectedCreative && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedCreative(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-md shadow-xl max-w-[900px] w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedCreative(null)} className="absolute top-3 right-3 z-10 w-7 h-7 rounded bg-black/10 hover:bg-black/20 flex items-center justify-center transition-colors">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#111113" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
            </button>
            <div className="flex flex-col md:flex-row">
              {/* Image */}
              <div className="md:w-[50%] bg-[#f4f4f6] flex items-center justify-center min-h-[300px]">
                {selectedCreative.hasImage ? (
                  <img src={`/api/ad-library/image?id=${selectedCreative.id}`} alt={selectedCreative.concept || 'Generated'} className="w-full h-full object-contain" />
                ) : (
                  <p className="text-[12px] text-[#9d9da8]">No image data</p>
                )}
              </div>
              {/* Details */}
              <div className="md:w-[50%] p-5">
                <p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-medium">{selectedCreative.clientName}</p>
                <h3 className="text-[16px] font-semibold text-[#111113] mt-1">{selectedCreative.concept || 'Untitled Creative'}</h3>
                <p className="text-[11px] text-[#9d9da8] mt-0.5">{new Date(selectedCreative.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>

                {/* Pipeline status */}
                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-medium mb-1.5">Pipeline Status</p>
                  <div className="flex gap-1 flex-wrap">
                    {PIPELINE_STAGES.map(stage => {
                      const isActive = selectedCreative.pipeline_status === stage.key
                      return (
                        <button
                          key={stage.key}
                          onClick={() => {
                            updatePipelineStatus(selectedCreative.id, stage.key)
                            setSelectedCreative({ ...selectedCreative, pipeline_status: stage.key })
                          }}
                          className={`px-2.5 py-1.5 text-[11px] font-semibold rounded transition-all ${isActive ? 'ring-2 ring-offset-1' : 'opacity-60 hover:opacity-100'}`}
                          style={{ backgroundColor: stage.bg, color: stage.color, ...(isActive ? { ringColor: stage.color } : {}) }}
                        >
                          {stage.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Metadata */}
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-3 text-[11px]">
                    {selectedCreative.aspect_ratio && (
                      <span className="px-1.5 py-0.5 bg-[#f4f4f6] text-[#6b6b76] rounded">{selectedCreative.aspect_ratio}</span>
                    )}
                    <span className="px-1.5 py-0.5 bg-[#f4f4f6] text-[#6b6b76] rounded">{selectedCreative.source === 'copywriter' ? 'Copywriter' : 'Creative Studio'}</span>
                    {selectedCreative.status === 'qa_warning' && (
                      <span className="px-1.5 py-0.5 bg-[#fef2f2] text-[#dc2626] rounded font-medium">QA Warning</span>
                    )}
                  </div>

                  {/* Winner reference */}
                  {selectedCreative.metadata?.winnerName && selectedCreative.metadata.winnerName !== 'Unknown Ad' && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-medium">Based On</p>
                      <p className="text-[12px] text-[#111113] mt-0.5">{selectedCreative.metadata.winnerName}</p>
                    </div>
                  )}

                  {/* QA issues */}
                  {selectedCreative.metadata?.qaIssues?.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#dc2626] font-medium">QA Issues</p>
                      <ul className="mt-0.5">
                        {selectedCreative.metadata.qaIssues.map((issue: string, i: number) => (
                          <li key={i} className="text-[11px] text-[#dc2626]">- {issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Model notes */}
                  {selectedCreative.metadata?.modelNotes && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-medium">Model Notes</p>
                      <p className="text-[11px] text-[#6b6b76] mt-0.5 whitespace-pre-wrap">{selectedCreative.metadata.modelNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
