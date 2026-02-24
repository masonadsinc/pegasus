'use client'

import { useState, useEffect, useRef } from 'react'

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
  { label: '1:1', value: '1:1', desc: 'Feed' },
  { label: '4:5', value: '4:5', desc: 'Portrait' },
  { label: '9:16', value: '9:16', desc: 'Stories' },
  { label: '16:9', value: '16:9', desc: 'Landscape' },
]

export function CreativeStudioUI({ clients }: { clients: Client[] }) {
  const [selectedClient, setSelectedClient] = useState('')
  const [winningAds, setWinningAds] = useState<WinningAd[]>([])
  const [selectedWinner, setSelectedWinner] = useState<WinningAd | null>(null)
  const [additionalRefs, setAdditionalRefs] = useState<Set<string>>(new Set())
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [resolution, setResolution] = useState('4K')
  const [mode, setMode] = useState<'variation' | 'refresh'>('variation')
  const [direction, setDirection] = useState('')
  const [generating, setGenerating] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [winnerAnalysis, setWinnerAnalysis] = useState('')
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [modelNotes, setModelNotes] = useState('')
  const [qaResult, setQaResult] = useState<{ pass: boolean; issues: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<GeneratedCreative[]>([])
  const [loadingAds, setLoadingAds] = useState(false)
  const [viewMode, setViewMode] = useState<'generate' | 'gallery'>('generate')
  const [previewCreative, setPreviewCreative] = useState<GeneratedCreative | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedClient) {
      loadWinningAds()
      loadHistory()
      setSelectedWinner(null)
      setAdditionalRefs(new Set())
      setGeneratedImage(null)
      setWinnerAnalysis('')
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
    try {
      const res = await fetch(`/api/creative-studio/history?clientId=${selectedClient}`)
      const data = await res.json()
      setHistory(data.creatives || [])
    } catch {}
  }

  function toggleAdditionalRef(adId: string) {
    if (selectedWinner?.platformAdId === adId) return
    const next = new Set(additionalRefs)
    if (next.has(adId)) next.delete(adId)
    else if (next.size < 5) next.add(adId)
    setAdditionalRefs(next)
  }

  function selectWinner(ad: WinningAd) {
    setSelectedWinner(ad)
    setAdditionalRefs(new Set())
    setGeneratedImage(null)
    setWinnerAnalysis('')
    setError(null)
    setQaResult(null)
    setModelNotes('')
  }

  async function generate() {
    if (!selectedWinner) return
    setGenerating(true)
    setGeneratedImage(null)
    setWinnerAnalysis('')
    setModelNotes('')
    setError(null)
    setQaResult(null)
    setStatusMsg('Starting...')

    const refUrls = winningAds
      .filter(a => additionalRefs.has(a.platformAdId))
      .map(a => a.imageUrl)

    try {
      const res = await fetch('/api/creative-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient,
          winnerImageUrl: selectedWinner.imageUrl,
          winnerName: selectedWinner.name,
          winnerStats: {
            spend: selectedWinner.spend,
            results: selectedWinner.results,
            cpr: selectedWinner.cpr,
            ctr: selectedWinner.ctr,
          },
          aspectRatio,
          resolution,
          mode,
          additionalDirection: direction,
          referenceImageUrls: refUrls,
        }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'status') setStatusMsg(data.message)
            else if (data.type === 'analysis') setWinnerAnalysis(data.text)
            else if (data.type === 'qa_warning') setQaResult({ pass: false, issues: data.issues })
            else if (data.type === 'error') { setError(data.message); break }
            else if (data.type === 'complete') {
              setGeneratedImage(data.imageData)
              setModelNotes(data.modelNotes || '')
              setQaResult(data.qa)
              if (data.winnerAnalysis) setWinnerAnalysis(data.winnerAnalysis)
              outputRef.current?.scrollIntoView({ behavior: 'smooth' })
              await loadHistory()
            }
          } catch {}
        }
      }
    } catch (e: any) {
      setError(e.message || 'Generation failed')
    }
    setGenerating(false)
    setStatusMsg('')
  }

  async function deleteCreative(id: string) {
    await fetch('/api/creative-studio/history', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setHistory(prev => prev.filter(c => c.id !== id))
    if (previewCreative?.id === id) setPreviewCreative(null)
  }

  function downloadImage(dataUrl: string, name: string) {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${name || 'creative'}.png`
    a.click()
  }

  const clientName = clients.find(c => c.id === selectedClient)?.name || ''
  const imageAds = winningAds.filter(a => !a.isVideo)

  return (
    <div className="p-6 lg:p-8 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[20px] font-semibold text-[#111113]">Creative Studio</h1>
          <p className="text-[12px] text-[#9d9da8] mt-0.5">Select a winning ad to generate variations automatically</p>
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

      {/* GENERATE VIEW */}
      {selectedClient && viewMode === 'generate' && (
        <div className="space-y-6">
          {/* Step 1: Select Winner */}
          <div className="border border-[#e8e8ec] rounded-md bg-white">
            <div className="px-4 py-3 border-b border-[#e8e8ec] flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-semibold text-[#111113]">Step 1: Select a Winning Ad</h3>
                <p className="text-[11px] text-[#9d9da8] mt-0.5">Top performers from the last 60 days, ranked by CPR. Click to use as the style anchor.</p>
              </div>
              <span className="text-[10px] text-[#9d9da8]">{imageAds.length} image ads</span>
            </div>
            {loadingAds ? (
              <div className="p-6 text-[12px] text-[#9d9da8] text-center">Loading winning ads...</div>
            ) : imageAds.length === 0 ? (
              <div className="p-6 text-[12px] text-[#9d9da8] text-center">No winning image ads found for this client</div>
            ) : (
              <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {imageAds.map((ad, i) => (
                  <button
                    key={ad.platformAdId}
                    onClick={() => selectWinner(ad)}
                    className={`relative rounded-md overflow-hidden border-2 transition-all text-left ${
                      selectedWinner?.platformAdId === ad.platformAdId
                        ? 'border-[#2563eb] ring-2 ring-[#2563eb]/20'
                        : additionalRefs.has(ad.platformAdId)
                        ? 'border-[#16a34a] ring-1 ring-[#16a34a]/20'
                        : 'border-transparent hover:border-[#e8e8ec]'
                    }`}
                  >
                    <div className="aspect-square bg-[#f8f8fa] relative">
                      <img src={ad.imageUrl} alt={ad.name} className="w-full h-full object-cover" />
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/70 text-white text-[9px] font-semibold rounded">
                        #{i + 1}
                      </div>
                      {selectedWinner?.platformAdId === ad.platformAdId && (
                        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-[#2563eb] text-white text-[9px] font-semibold rounded">
                          SELECTED
                        </div>
                      )}
                      {additionalRefs.has(ad.platformAdId) && (
                        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-[#16a34a] text-white text-[9px] font-semibold rounded">
                          REF
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="text-[10px] text-white font-semibold">${ad.cpr.toFixed(2)} CPR</p>
                        <p className="text-[9px] text-white/70">${ad.spend.toFixed(0)} / {ad.results} results</p>
                      </div>
                    </div>
                    <div className="p-2 bg-white">
                      <p className="text-[10px] text-[#111113] truncate">{ad.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: Configure + Generate (only if winner selected) */}
          {selectedWinner && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Selected winner + additional refs */}
              <div className="space-y-4">
                {/* Selected winner preview */}
                <div className="border border-[#2563eb] rounded-md bg-white overflow-hidden">
                  <div className="px-4 py-2 bg-[#2563eb]/5 border-b border-[#2563eb]/20">
                    <p className="text-[11px] font-semibold text-[#2563eb]">STYLE ANCHOR</p>
                  </div>
                  <div className="aspect-square bg-[#f8f8fa]">
                    <img src={selectedWinner.imageUrl} alt={selectedWinner.name} className="w-full h-full object-contain" />
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-[12px] font-semibold text-[#111113] truncate">{selectedWinner.name}</p>
                    <div className="flex gap-3 text-[10px] text-[#9d9da8]">
                      <span>${selectedWinner.cpr.toFixed(2)} CPR</span>
                      <span>{selectedWinner.results} results</span>
                      <span>{selectedWinner.ctr.toFixed(2)}% CTR</span>
                    </div>
                    {selectedWinner.headline && (
                      <p className="text-[11px] text-[#6b6b76] italic">"{selectedWinner.headline}"</p>
                    )}
                  </div>
                </div>

                {/* Additional references */}
                {imageAds.length > 1 && (
                  <div className="border border-[#e8e8ec] rounded-md bg-white">
                    <div className="px-4 py-2 border-b border-[#e8e8ec] flex items-center justify-between">
                      <p className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider">Additional References (optional)</p>
                      <span className="text-[10px] text-[#9d9da8]">{additionalRefs.size}/5</span>
                    </div>
                    <div className="p-2 grid grid-cols-4 gap-1.5 max-h-[200px] overflow-y-auto">
                      {imageAds.filter(a => a.platformAdId !== selectedWinner.platformAdId).map(ad => (
                        <button
                          key={ad.platformAdId}
                          onClick={() => toggleAdditionalRef(ad.platformAdId)}
                          className={`relative aspect-square rounded overflow-hidden border-2 transition-all ${
                            additionalRefs.has(ad.platformAdId) ? 'border-[#16a34a]' : 'border-transparent hover:border-[#e8e8ec]'
                          }`}
                        >
                          <img src={ad.imageUrl} alt="" className="w-full h-full object-cover" />
                          {additionalRefs.has(ad.platformAdId) && (
                            <div className="absolute inset-0 bg-[#16a34a]/20 flex items-center justify-center">
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M3 8l4 4 6-7" /></svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Settings + Output */}
              <div className="lg:col-span-2 space-y-4">
                {/* Generation settings */}
                <div className="border border-[#e8e8ec] rounded-md bg-white p-4">
                  <div className="flex flex-wrap gap-4 items-end">
                    {/* Mode */}
                    <div>
                      <label className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider block mb-2">Mode</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setMode('variation')}
                          className={`px-3 py-1.5 rounded border text-[12px] font-medium transition-colors ${
                            mode === 'variation' ? 'border-[#2563eb] bg-[#2563eb]/5 text-[#2563eb]' : 'border-[#e8e8ec] text-[#111113]'
                          }`}
                        >
                          Variation
                        </button>
                        <button
                          onClick={() => setMode('refresh')}
                          className={`px-3 py-1.5 rounded border text-[12px] font-medium transition-colors ${
                            mode === 'refresh' ? 'border-[#f59e0b] bg-[#f59e0b]/5 text-[#f59e0b]' : 'border-[#e8e8ec] text-[#111113]'
                          }`}
                        >
                          Refresh (New Direction)
                        </button>
                      </div>
                    </div>

                    {/* Aspect ratio */}
                    <div>
                      <label className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider block mb-2">Ratio</label>
                      <div className="flex gap-1">
                        {ASPECT_RATIOS.map(ar => (
                          <button
                            key={ar.value}
                            onClick={() => setAspectRatio(ar.value)}
                            className={`px-2.5 py-1.5 rounded border text-[11px] font-medium transition-colors ${
                              aspectRatio === ar.value ? 'border-[#2563eb] bg-[#2563eb]/5 text-[#2563eb]' : 'border-[#e8e8ec] text-[#111113]'
                            }`}
                            title={ar.desc}
                          >
                            {ar.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Resolution */}
                    <div>
                      <label className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider block mb-2">Quality</label>
                      <div className="flex gap-1">
                        {['1K', '2K', '4K'].map(r => (
                          <button
                            key={r}
                            onClick={() => setResolution(r)}
                            className={`px-2.5 py-1.5 rounded border text-[11px] font-medium transition-colors ${
                              resolution === r ? 'border-[#2563eb] bg-[#2563eb]/5 text-[#2563eb]' : 'border-[#e8e8ec] text-[#111113]'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Generate button */}
                    <button
                      onClick={generate}
                      disabled={generating}
                      className="px-6 py-2 rounded bg-[#2563eb] text-white text-[13px] font-medium hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors ml-auto"
                    >
                      {generating ? 'Generating...' : mode === 'refresh' ? 'Generate Refresh' : 'Generate Variation'}
                    </button>
                  </div>

                  {/* Advanced: additional direction */}
                  <div className="mt-3">
                    <button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="text-[11px] text-[#9d9da8] hover:text-[#111113] transition-colors flex items-center gap-1"
                    >
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`}><path d="M6 4l4 4-4 4" /></svg>
                      Additional direction (optional)
                    </button>
                    {showAdvanced && (
                      <textarea
                        value={direction}
                        onChange={e => setDirection(e.target.value)}
                        rows={3}
                        placeholder="Add specific creative direction... e.g. 'Use a before/after split', 'Focus on the pricing angle', 'Show the service being performed'"
                        className="w-full mt-2 px-3 py-2 rounded border border-[#e8e8ec] text-[12px] text-[#111113] placeholder:text-[#9d9da8] resize-none focus:outline-none focus:border-[#2563eb]"
                      />
                    )}
                  </div>
                </div>

                {/* Status during generation */}
                {generating && statusMsg && (
                  <div className="flex items-center gap-3 px-4 py-3 border border-[#e8e8ec] rounded-md bg-[#f8f8fa]">
                    <div className="w-2 h-2 bg-[#2563eb] rounded-full animate-pulse flex-shrink-0" />
                    <span className="text-[12px] text-[#111113]">{statusMsg}</span>
                  </div>
                )}

                {/* Winner analysis (shows during/after generation) */}
                {winnerAnalysis && (
                  <div className="border border-[#e8e8ec] rounded-md bg-white">
                    <div className="px-4 py-2 border-b border-[#e8e8ec] bg-[#f8f8fa]">
                      <p className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider">Winner Analysis</p>
                    </div>
                    <div className="p-4 text-[12px] text-[#111113] leading-relaxed max-h-[200px] overflow-y-auto whitespace-pre-line">
                      {winnerAnalysis}
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="bg-[#fef2f2] border border-[#fecaca] rounded-md p-3 text-[12px] text-[#dc2626]">{error}</div>
                )}

                {/* Generated output */}
                {generatedImage && !generating && (
                  <div ref={outputRef} className="border border-[#e8e8ec] rounded-md bg-white overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#e8e8ec] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[13px] font-semibold text-[#111113]">Generated Creative</h3>
                        {qaResult && (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${qaResult.pass ? 'bg-[#16a34a]/10 text-[#16a34a]' : 'bg-[#f59e0b]/10 text-[#f59e0b]'}`}>
                            {qaResult.pass ? 'QA Passed' : `QA Warning: ${qaResult.issues.join(', ')}`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={generate}
                          className="px-3 py-1 rounded border border-[#e8e8ec] text-[11px] font-medium text-[#111113] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors"
                        >
                          Regenerate
                        </button>
                        <button
                          onClick={() => downloadImage(generatedImage, `${clientName}-${mode}`)}
                          className="px-3 py-1 rounded border border-[#e8e8ec] text-[11px] font-medium text-[#111113] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors"
                        >
                          Download
                        </button>
                      </div>
                    </div>
                    <div className="p-4 flex justify-center bg-[#f8f8fa]">
                      <img src={generatedImage} alt="Generated creative" className="max-w-full max-h-[600px] object-contain rounded" />
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
        </div>
      )}

      {/* GALLERY VIEW */}
      {selectedClient && viewMode === 'gallery' && (
        <div>
          {history.length === 0 ? (
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
                      {c.metadata?.qaPass === false && (
                        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-[#f59e0b] text-white text-[9px] font-semibold rounded">QA WARNING</div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-[12px] font-semibold text-[#111113] truncate">{c.concept || 'Untitled'}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-[#9d9da8]">{c.aspect_ratio} / {c.resolution}</span>
                        <span className="text-[10px] text-[#9d9da8]">{formatTimeAgo(c.created_at)}</span>
                      </div>
                      {c.metadata?.winnerName && (
                        <p className="text-[10px] text-[#9d9da8] mt-0.5 truncate">From: {c.metadata.winnerName}</p>
                      )}
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
                        <button onClick={() => downloadImage(previewCreative.image_data, previewCreative.concept || 'creative')} className="px-3 py-1 rounded border border-[#e8e8ec] text-[11px] font-medium text-[#111113] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors">Download</button>
                        <button onClick={() => { deleteCreative(previewCreative.id); setPreviewCreative(null) }} className="px-3 py-1 rounded border border-[#e8e8ec] text-[11px] font-medium text-[#dc2626] hover:border-[#dc2626] transition-colors">Delete</button>
                        <button onClick={() => setPreviewCreative(null)} className="text-[#9d9da8] hover:text-[#111113]">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                        </button>
                      </div>
                    </div>
                    <div className="p-4 bg-[#f8f8fa] flex justify-center">
                      <img src={previewCreative.image_data} alt="" className="max-w-full max-h-[500px] object-contain" />
                    </div>
                    <div className="p-4 border-t border-[#e8e8ec] space-y-3">
                      {previewCreative.metadata?.winnerAnalysis && (
                        <div>
                          <p className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider mb-1">Winner Analysis</p>
                          <p className="text-[12px] text-[#111113] whitespace-pre-line leading-relaxed max-h-[150px] overflow-y-auto">{previewCreative.metadata.winnerAnalysis}</p>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-4">
                        {previewCreative.metadata?.winnerName && (
                          <div>
                            <p className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider">Based On</p>
                            <p className="text-[12px] text-[#111113]">{previewCreative.metadata.winnerName}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider">Ratio</p>
                          <p className="text-[12px] text-[#111113]">{previewCreative.aspect_ratio}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider">Resolution</p>
                          <p className="text-[12px] text-[#111113]">{previewCreative.resolution}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider">Mode</p>
                          <p className="text-[12px] text-[#111113]">{previewCreative.metadata?.mode || 'variation'}</p>
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
