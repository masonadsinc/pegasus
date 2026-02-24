'use client'

import { useState, useEffect } from 'react'

interface Client {
  id: string
  name: string
  slug: string
}

interface WinningAd {
  platformAdId: string
  name: string
  imageUrl: string
  thumbnailUrl: string | null
  headline: string | null
  body: string | null
  spend: number
  results: number
  cpr: number
  ctr: number
  isVideo: boolean
}

interface GeneratedCreative {
  id: string
  prompt: string
  concept: string | null
  aspect_ratio: string
  resolution: string
  image_data: string
  metadata: any
  created_at: string
}

const ASPECT_RATIOS = [
  { label: '1:1', value: '1:1', desc: 'Square (Feed)' },
  { label: '4:5', value: '4:5', desc: 'Portrait (Feed)' },
  { label: '9:16', value: '9:16', desc: 'Vertical (Stories/Reels)' },
  { label: '16:9', value: '16:9', desc: 'Landscape' },
]

const RESOLUTIONS = ['1K', '2K', '4K']

const PROMPT_TEMPLATES = [
  {
    name: 'Photorealistic Service',
    template: `A photorealistic [shot type] of [subject], [action], set in [environment]. Illuminated by [lighting]. Captured with [camera/lens details]. Text overlay: "[HEADLINE]" in [font style] at [position]. Subtext: "[SUBHEAD/CTA]" below. Brand colors: [colors] accents.`,
  },
  {
    name: 'Direct Response Offer',
    template: `A professional advertisement for [brand/service]. Headline: "[HEADLINE]" in [font style] — large, prominent, [position]. Secondary: "[SUBHEAD]" — smaller, supporting. CTA button: "[CTA TEXT]" in [color] at [position]. Visual: [subject description]. Background: [color/gradient]. Brand colors: [colors].`,
  },
  {
    name: 'Before/After',
    template: `A split-screen before-and-after comparison for [service]. Left side: [before state description]. Right side: [after state description]. Clean dividing line in the center. Headline: "[HEADLINE]" at top. CTA: "[CTA TEXT]" at bottom. Professional photography, natural lighting.`,
  },
  {
    name: 'Social Proof / Testimonial',
    template: `A clean, professional ad featuring a customer testimonial for [service]. Large quote text: "[TESTIMONIAL]" in [font style]. Star rating: 5 stars. Customer context: "[Name, Location]". Background: [clean solid or gradient]. CTA: "[CTA TEXT]" at bottom. Brand colors: [colors].`,
  },
]

export function CreativeStudioUI({ clients }: { clients: Client[] }) {
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [winningAds, setWinningAds] = useState<WinningAd[]>([])
  const [selectedRefs, setSelectedRefs] = useState<Set<string>>(new Set())
  const [prompt, setPrompt] = useState('')
  const [concept, setConcept] = useState('')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [resolution, setResolution] = useState('4K')
  const [generating, setGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [modelNotes, setModelNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<GeneratedCreative[]>([])
  const [loadingAds, setLoadingAds] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [viewMode, setViewMode] = useState<'generate' | 'gallery'>('generate')
  const [previewCreative, setPreviewCreative] = useState<GeneratedCreative | null>(null)

  useEffect(() => {
    if (selectedClient) {
      loadWinningAds()
      loadHistory()
      setSelectedRefs(new Set())
      setGeneratedImage(null)
      setError(null)
    }
  }, [selectedClient])

  async function loadWinningAds() {
    setLoadingAds(true)
    try {
      const res = await fetch(`/api/creative-studio/winning-ads?clientId=${selectedClient}&days=60`)
      const data = await res.json()
      setWinningAds(data.ads || [])
    } catch {}
    setLoadingAds(false)
  }

  async function loadHistory() {
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/creative-studio/history?clientId=${selectedClient}`)
      const data = await res.json()
      setHistory(data.creatives || [])
    } catch {}
    setLoadingHistory(false)
  }

  function toggleRef(adId: string) {
    const next = new Set(selectedRefs)
    if (next.has(adId)) next.delete(adId)
    else if (next.size < 6) next.add(adId)
    setSelectedRefs(next)
  }

  function applyTemplate(template: string) {
    setPrompt(template)
  }

  async function generate() {
    if (!prompt.trim()) return
    setGenerating(true)
    setGeneratedImage(null)
    setModelNotes('')
    setError(null)

    const referenceImageUrls = winningAds
      .filter(a => selectedRefs.has(a.platformAdId))
      .map(a => a.imageUrl)

    try {
      const res = await fetch('/api/creative-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient,
          prompt,
          aspectRatio,
          resolution,
          referenceImageUrls,
          concept,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Generation failed')
      } else {
        setGeneratedImage(data.imageData)
        setModelNotes(data.modelNotes || '')
        await loadHistory()
      }
    } catch (e: any) {
      setError(e.message || 'Generation failed')
    }
    setGenerating(false)
  }

  async function deleteCreative(id: string) {
    try {
      await fetch('/api/creative-studio/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setHistory(prev => prev.filter(c => c.id !== id))
      if (previewCreative?.id === id) setPreviewCreative(null)
    } catch {}
  }

  function downloadImage(dataUrl: string, name: string) {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${name || 'creative'}.png`
    a.click()
  }

  const clientName = clients.find(c => c.id === selectedClient)?.name || ''

  return (
    <div className="p-6 lg:p-8 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[20px] font-semibold text-[#111113]">Creative Studio</h1>
          <p className="text-[12px] text-[#9d9da8] mt-0.5">Generate ad creatives from your winning ads</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedClient}
            onChange={e => setSelectedClient(e.target.value)}
            className="px-3 py-1.5 rounded border border-[#e8e8ec] text-[13px] text-[#111113] bg-white min-w-[200px]"
          >
            <option value="">Select client...</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {selectedClient && (
            <div className="flex items-center border border-[#e8e8ec] rounded overflow-hidden">
              <button
                onClick={() => setViewMode('generate')}
                className={`px-3 py-1.5 text-[11px] font-medium border-r border-[#e8e8ec] transition-colors ${viewMode === 'generate' ? 'bg-[#111113] text-white' : 'bg-white text-[#9d9da8] hover:text-[#111113]'}`}
              >
                Generate
              </button>
              <button
                onClick={() => setViewMode('gallery')}
                className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${viewMode === 'gallery' ? 'bg-[#111113] text-white' : 'bg-white text-[#9d9da8] hover:text-[#111113]'}`}
              >
                Gallery ({history.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {!selectedClient && (
        <div className="border border-dashed border-[#e8e8ec] rounded-md p-12 text-center">
          <p className="text-[14px] text-[#9d9da8]">Select a client to start generating creatives</p>
        </div>
      )}

      {selectedClient && viewMode === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: References + Settings */}
          <div className="lg:col-span-1 space-y-4">
            {/* Reference Ads */}
            <div className="border border-[#e8e8ec] rounded-md bg-white">
              <div className="px-4 py-3 border-b border-[#e8e8ec] flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-[#111113]">Reference Images</h3>
                <span className="text-[10px] text-[#9d9da8]">{selectedRefs.size}/6 selected</span>
              </div>
              {loadingAds ? (
                <div className="p-4 text-[12px] text-[#9d9da8]">Loading winning ads...</div>
              ) : winningAds.length === 0 ? (
                <div className="p-4 text-[12px] text-[#9d9da8]">No winning ads with images found</div>
              ) : (
                <div className="p-3 grid grid-cols-3 gap-2 max-h-[400px] overflow-y-auto">
                  {winningAds.filter(a => !a.isVideo).map(ad => (
                    <button
                      key={ad.platformAdId}
                      onClick={() => toggleRef(ad.platformAdId)}
                      className={`relative aspect-square rounded overflow-hidden border-2 transition-all ${
                        selectedRefs.has(ad.platformAdId)
                          ? 'border-[#2563eb] ring-2 ring-[#2563eb]/20'
                          : 'border-transparent hover:border-[#e8e8ec]'
                      }`}
                    >
                      <img src={ad.imageUrl} alt={ad.name} className="w-full h-full object-cover" />
                      {selectedRefs.has(ad.platformAdId) && (
                        <div className="absolute top-1 right-1 w-5 h-5 bg-[#2563eb] rounded-full flex items-center justify-center">
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M3 8l4 4 6-7" /></svg>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                        <span className="text-[9px] text-white font-medium">${ad.cpr.toFixed(2)} CPR</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="border border-[#e8e8ec] rounded-md bg-white p-4 space-y-4">
              <div>
                <label className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider block mb-2">Aspect Ratio</label>
                <div className="grid grid-cols-2 gap-2">
                  {ASPECT_RATIOS.map(ar => (
                    <button
                      key={ar.value}
                      onClick={() => setAspectRatio(ar.value)}
                      className={`px-3 py-2 rounded border text-left transition-colors ${
                        aspectRatio === ar.value
                          ? 'border-[#2563eb] bg-[#2563eb]/5 text-[#2563eb]'
                          : 'border-[#e8e8ec] text-[#111113] hover:border-[#9d9da8]'
                      }`}
                    >
                      <span className="text-[12px] font-medium block">{ar.label}</span>
                      <span className="text-[10px] text-[#9d9da8]">{ar.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider block mb-2">Resolution</label>
                <div className="flex gap-2">
                  {RESOLUTIONS.map(r => (
                    <button
                      key={r}
                      onClick={() => setResolution(r)}
                      className={`px-4 py-1.5 rounded border text-[12px] font-medium transition-colors ${
                        resolution === r
                          ? 'border-[#2563eb] bg-[#2563eb]/5 text-[#2563eb]'
                          : 'border-[#e8e8ec] text-[#111113] hover:border-[#9d9da8]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider block mb-2">Concept Name (optional)</label>
                <input
                  type="text"
                  value={concept}
                  onChange={e => setConcept(e.target.value)}
                  placeholder="e.g. ceramic-coating-v1"
                  className="w-full px-3 py-1.5 rounded border border-[#e8e8ec] text-[13px] text-[#111113] placeholder:text-[#9d9da8]"
                />
              </div>
            </div>
          </div>

          {/* Right: Prompt + Output */}
          <div className="lg:col-span-2 space-y-4">
            {/* Templates */}
            <div className="border border-[#e8e8ec] rounded-md bg-white">
              <div className="px-4 py-3 border-b border-[#e8e8ec]">
                <h3 className="text-[13px] font-semibold text-[#111113]">Prompt Templates</h3>
              </div>
              <div className="p-3 flex flex-wrap gap-2">
                {PROMPT_TEMPLATES.map(t => (
                  <button
                    key={t.name}
                    onClick={() => applyTemplate(t.template)}
                    className="px-3 py-1.5 rounded border border-[#e8e8ec] text-[11px] font-medium text-[#111113] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt input */}
            <div className="border border-[#e8e8ec] rounded-md bg-white">
              <div className="px-4 py-3 border-b border-[#e8e8ec] flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-[#111113]">Prompt</h3>
                <span className="text-[10px] text-[#9d9da8]">{prompt.length} chars</span>
              </div>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={8}
                placeholder="Describe the ad creative you want to generate. Be specific about the scene, lighting, text overlays, colors, and composition..."
                className="w-full px-4 py-3 text-[13px] text-[#111113] placeholder:text-[#9d9da8] resize-none border-0 focus:outline-none leading-relaxed"
              />
              <div className="px-4 py-3 border-t border-[#e8e8ec] flex items-center justify-between">
                <div className="flex items-center gap-3 text-[11px] text-[#9d9da8]">
                  {selectedRefs.size > 0 && <span>{selectedRefs.size} reference(s) attached</span>}
                  <span>{aspectRatio} / {resolution}</span>
                </div>
                <button
                  onClick={generate}
                  disabled={generating || !prompt.trim()}
                  className="px-5 py-2 rounded bg-[#2563eb] text-white text-[13px] font-medium hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors"
                >
                  {generating ? 'Generating...' : 'Generate Creative'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-[#fef2f2] border border-[#fecaca] rounded-md p-3 text-[12px] text-[#dc2626]">
                {error}
              </div>
            )}

            {/* Generating state */}
            {generating && (
              <div className="border border-[#e8e8ec] rounded-md bg-white p-8 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
                <p className="text-[13px] text-[#111113]">Generating creative for {clientName}...</p>
                <p className="text-[11px] text-[#9d9da8]">This usually takes 10-30 seconds</p>
              </div>
            )}

            {/* Generated output */}
            {generatedImage && !generating && (
              <div className="border border-[#e8e8ec] rounded-md bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-[#e8e8ec] flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-[#111113]">Generated Creative</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadImage(generatedImage, concept || `${clientName}-creative`)}
                      className="px-3 py-1 rounded border border-[#e8e8ec] text-[11px] font-medium text-[#111113] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors"
                    >
                      Download
                    </button>
                  </div>
                </div>
                <div className="p-4 flex justify-center bg-[#f8f8fa]">
                  <img
                    src={generatedImage}
                    alt="Generated creative"
                    className="max-w-full max-h-[600px] object-contain rounded"
                  />
                </div>
                {modelNotes && (
                  <div className="px-4 py-3 border-t border-[#e8e8ec]">
                    <p className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider mb-1">Model Notes</p>
                    <p className="text-[12px] text-[#111113] whitespace-pre-line">{modelNotes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gallery View */}
      {selectedClient && viewMode === 'gallery' && (
        <div>
          {loadingHistory ? (
            <div className="text-[13px] text-[#9d9da8] p-8 text-center">Loading gallery...</div>
          ) : history.length === 0 ? (
            <div className="border border-dashed border-[#e8e8ec] rounded-md p-12 text-center">
              <p className="text-[14px] text-[#9d9da8]">No creatives generated yet for this client</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {history.map(c => (
                  <div
                    key={c.id}
                    className="border border-[#e8e8ec] rounded-md overflow-hidden bg-white group cursor-pointer hover:border-[#2563eb]/30 transition-colors"
                    onClick={() => setPreviewCreative(c)}
                  >
                    <div className="aspect-square bg-[#f8f8fa] relative">
                      {c.image_data ? (
                        <img src={c.image_data} alt={c.concept || 'Creative'} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[11px] text-[#9d9da8]">No preview</div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </div>
                    <div className="p-3">
                      <p className="text-[12px] font-semibold text-[#111113] truncate">{c.concept || 'Untitled'}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-[#9d9da8]">{c.aspect_ratio} / {c.resolution}</span>
                        <span className="text-[10px] text-[#9d9da8]">{formatTimeAgo(c.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Preview modal */}
              {previewCreative && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPreviewCreative(null)}>
                  <div className="bg-white rounded-md max-w-[900px] w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                    <div className="px-4 py-3 border-b border-[#e8e8ec] flex items-center justify-between">
                      <h3 className="text-[14px] font-semibold text-[#111113]">{previewCreative.concept || 'Creative'}</h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => downloadImage(previewCreative.image_data, previewCreative.concept || 'creative')}
                          className="px-3 py-1 rounded border border-[#e8e8ec] text-[11px] font-medium text-[#111113] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => { deleteCreative(previewCreative.id); setPreviewCreative(null) }}
                          className="px-3 py-1 rounded border border-[#e8e8ec] text-[11px] font-medium text-[#dc2626] hover:border-[#dc2626] transition-colors"
                        >
                          Delete
                        </button>
                        <button onClick={() => setPreviewCreative(null)} className="text-[#9d9da8] hover:text-[#111113] transition-colors">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                        </button>
                      </div>
                    </div>
                    <div className="p-4 bg-[#f8f8fa] flex justify-center">
                      <img src={previewCreative.image_data} alt="" className="max-w-full max-h-[500px] object-contain" />
                    </div>
                    <div className="p-4 border-t border-[#e8e8ec] space-y-3">
                      <div>
                        <p className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider mb-1">Prompt</p>
                        <p className="text-[12px] text-[#111113] whitespace-pre-line leading-relaxed">{previewCreative.prompt}</p>
                      </div>
                      <div className="flex gap-4">
                        <div>
                          <p className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider">Ratio</p>
                          <p className="text-[12px] text-[#111113]">{previewCreative.aspect_ratio}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider">Resolution</p>
                          <p className="text-[12px] text-[#111113]">{previewCreative.resolution}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider">Generated</p>
                          <p className="text-[12px] text-[#111113]">{new Date(previewCreative.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function formatTimeAgo(dateStr: string): string {
  const hours = Math.round((Date.now() - new Date(dateStr).getTime()) / 3600000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}
