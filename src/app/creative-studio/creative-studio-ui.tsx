'use client'

import { useState, useEffect, useRef } from 'react'

interface Client { id: string; name: string; slug: string }

interface WinningAd {
  platformAdId: string; name: string; imageUrl: string; thumbnailUrl: string | null
  headline: string | null; body: string | null; spend: number; results: number
  cpr: number; ctr: number; isVideo: boolean
}

interface GeneratedCreative {
  id: string; prompt: string; concept: string | null; aspect_ratio: string
  resolution: string; image_data: string; metadata: any; created_at: string
}

interface BrandColor { name: string; hex: string }
interface BrandAssets {
  brand_colors: BrandColor[]; style_guide: string; creative_prefs: string
  hard_rules: string; visual_tone: string
}

const ASPECT_RATIOS = [
  { label: '1:1', value: '1:1', desc: 'Feed' },
  { label: '4:5', value: '4:5', desc: 'Portrait' },
  { label: '9:16', value: '9:16', desc: 'Stories' },
  { label: '16:9', value: '16:9', desc: 'Landscape' },
]

export function CreativeStudioUI({ clients, initialClientId }: { clients: Client[]; initialClientId?: string }) {
  const [selectedClient, setSelectedClient] = useState(initialClientId || '')
  const [winningAds, setWinningAds] = useState<WinningAd[]>([])
  const [selectedWinner, setSelectedWinner] = useState<WinningAd | null>(null)
  const [additionalRefs, setAdditionalRefs] = useState<Set<string>>(new Set())
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [resolution, setResolution] = useState('2K')
  const [mode, setMode] = useState<'variation' | 'refresh'>('variation')
  const [direction, setDirection] = useState('')
  const [generating, setGenerating] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [logEntries, setLogEntries] = useState<{ time: string; type: string; message: string }[]>([])
  const [winnerAnalysis, setWinnerAnalysis] = useState('')
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [modelNotes, setModelNotes] = useState('')
  const [qaResult, setQaResult] = useState<{ pass: boolean; issues: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<GeneratedCreative[]>([])
  const [loadingAds, setLoadingAds] = useState(false)
  const [viewMode, setViewMode] = useState<'generate' | 'gallery' | 'settings'>('generate')
  const [previewCreative, setPreviewCreative] = useState<GeneratedCreative | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [uploadedImages, setUploadedImages] = useState<{ name: string; dataUrl: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Brand settings
  const [brandColors, setBrandColors] = useState<BrandColor[]>([])
  const [styleGuide, setStyleGuide] = useState('')
  const [creativePrefs, setCreativePrefs] = useState('')
  const [hardRules, setHardRules] = useState('')
  const [visualTone, setVisualTone] = useState('')
  const [savingAssets, setSavingAssets] = useState(false)
  const [assetsSaved, setAssetsSaved] = useState(false)
  const [assetsLoaded, setAssetsLoaded] = useState(false)
  const [autoConfiguring, setAutoConfiguring] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedClient) {
      loadWinningAds()
      loadHistory()
      loadBrandAssets()
      setSelectedWinner(null)
      setAdditionalRefs(new Set())
      setGeneratedImage(null)
      setWinnerAnalysis('')
      setError(null)
      setShowFeedback(false)
      setFeedback('')
      setUploadedImages([])
    }
  }, [selectedClient])

  async function handleFileUpload(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    const formData = new FormData()
    for (let i = 0; i < Math.min(files.length, 6 - uploadedImages.length); i++) {
      formData.append('images', files[i])
    }
    try {
      const res = await fetch('/api/creative-studio/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.images) setUploadedImages(prev => [...prev, ...data.images].slice(0, 6))
    } catch {}
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeUpload(index: number) {
    setUploadedImages(prev => prev.filter((_, i) => i !== index))
  }

  async function loadWinningAds() {
    setLoadingAds(true)
    try {
      const res = await fetch(`/api/creative-studio/winning-ads?clientId=${selectedClient}&days=60`)
      setWinningAds((await res.json()).ads || [])
    } catch {}
    setLoadingAds(false)
  }

  async function loadHistory() {
    try {
      const res = await fetch(`/api/creative-studio/history?clientId=${selectedClient}`)
      setHistory((await res.json()).creatives || [])
    } catch {}
  }

  async function loadBrandAssets() {
    setAssetsLoaded(false)
    try {
      const res = await fetch(`/api/creative-studio/brand-assets?clientId=${selectedClient}`)
      const data = await res.json()
      if (data.assets) {
        setBrandColors(data.assets.brand_colors || [])
        setStyleGuide(data.assets.style_guide || '')
        setCreativePrefs(data.assets.creative_prefs || '')
        setHardRules(data.assets.hard_rules || '')
        setVisualTone(data.assets.visual_tone || '')
      } else {
        setBrandColors([]); setStyleGuide(''); setCreativePrefs(''); setHardRules(''); setVisualTone('')
      }
    } catch {}
    setAssetsLoaded(true)
  }

  async function saveBrandAssets() {
    setSavingAssets(true)
    try {
      await fetch('/api/creative-studio/brand-assets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClient, brandColors, styleGuide, creativePrefs, hardRules, visualTone }),
      })
      setAssetsSaved(true)
      setTimeout(() => setAssetsSaved(false), 2000)
    } catch {}
    setSavingAssets(false)
  }

  async function autoConfigure() {
    setAutoConfiguring(true)
    try {
      const res = await fetch('/api/creative-studio/auto-configure', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClient }),
      })
      const data = await res.json()
      if (data.success && data.assets) {
        setBrandColors(data.assets.brand_colors || [])
        setVisualTone(data.assets.visual_tone || '')
        setStyleGuide(data.assets.style_guide || '')
        setCreativePrefs(data.assets.creative_prefs || '')
        setHardRules(data.assets.hard_rules || '')
        setViewMode('settings')
      } else {
        alert(data.error || 'Auto-configuration failed')
      }
    } catch { alert('Auto-configuration failed') }
    setAutoConfiguring(false)
  }

  function addColor() { setBrandColors(prev => [...prev, { name: '', hex: '#000000' }]) }
  function removeColor(i: number) { setBrandColors(prev => prev.filter((_, idx) => idx !== i)) }
  function updateColor(i: number, field: 'name' | 'hex', value: string) {
    setBrandColors(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  }

  function toggleAdditionalRef(adId: string) {
    if (selectedWinner?.platformAdId === adId) return
    const next = new Set(additionalRefs)
    if (next.has(adId)) next.delete(adId); else if (next.size < 5) next.add(adId)
    setAdditionalRefs(next)
  }

  function selectWinner(ad: WinningAd) {
    setSelectedWinner(ad); setAdditionalRefs(new Set()); setGeneratedImage(null)
    setWinnerAnalysis(''); setError(null); setQaResult(null); setModelNotes('')
    setShowFeedback(false); setFeedback('')
  }

  async function generate() {
    if (!selectedWinner) return
    setGenerating(true); setGeneratedImage(null); setWinnerAnalysis(''); setModelNotes('')
    setError(null); setQaResult(null); setStatusMsg('Starting...')
    setLogEntries([{ time: now(), type: 'info', message: 'Starting generation...' }])

    const refUrls = winningAds.filter(a => additionalRefs.has(a.platformAdId)).map(a => a.imageUrl)

    try {
      const res = await fetch('/api/creative-studio/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient, winnerImageUrl: selectedWinner.imageUrl,
          winnerName: selectedWinner.name,
          winnerStats: { spend: selectedWinner.spend, results: selectedWinner.results, cpr: selectedWinner.cpr, ctr: selectedWinner.ctr },
          aspectRatio, resolution, mode, additionalDirection: direction, referenceImageUrls: refUrls,
          uploadedImages: uploadedImages.map(img => img.dataUrl),
        }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n'); buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'status') {
              setStatusMsg(data.message)
              setLogEntries(prev => [...prev, { time: now(), type: 'info', message: data.message }])
            }
            else if (data.type === 'analysis') {
              setWinnerAnalysis(data.text)
              const lines = (data.text || '').split('\n').filter(Boolean).length
              setLogEntries(prev => [...prev, { time: now(), type: 'success', message: `Winner analysis complete (${lines} data points extracted)` }])
            }
            else if (data.type === 'qa_warning') {
              setQaResult({ pass: false, issues: data.issues })
              setLogEntries(prev => [...prev, { time: now(), type: 'warning', message: `QA issues detected: ${data.issues.join(', ')}` }])
            }
            else if (data.type === 'error') {
              setError(data.message)
              setLogEntries(prev => [...prev, { time: now(), type: 'error', message: data.message }])
              break
            }
            else if (data.type === 'complete') {
              setGeneratedImage(data.imageData); setModelNotes(data.modelNotes || '')
              setQaResult(data.qa)
              if (data.winnerAnalysis) setWinnerAnalysis(data.winnerAnalysis)
              const logItems: { time: string; type: string; message: string }[] = []
              if (data.qa?.pass) logItems.push({ time: now(), type: 'success', message: 'QA check passed' })
              else if (data.qa && !data.qa.pass) logItems.push({ time: now(), type: 'warning', message: `QA retry — issues: ${data.qa.issues?.join(', ') || 'unknown'}` })
              if (data.conceptSummary) logItems.push({ time: now(), type: 'info', message: `Concept: ${data.conceptSummary}` })
              logItems.push({ time: now(), type: 'success', message: 'Creative generated and saved' })
              setLogEntries(prev => [...prev, ...logItems])
              outputRef.current?.scrollIntoView({ behavior: 'smooth' })
              await loadHistory()
            }
          } catch {}
        }
      }
    } catch (e: any) { setError(e.message || 'Generation failed') }
    setGenerating(false); setStatusMsg('')
  }

  async function deleteCreative(id: string) {
    await fetch('/api/creative-studio/history', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setHistory(prev => prev.filter(c => c.id !== id))
    if (previewCreative?.id === id) setPreviewCreative(null)
  }

  function downloadImage(dataUrl: string, name: string) {
    const a = document.createElement('a'); a.href = dataUrl; a.download = `${name || 'creative'}.png`; a.click()
  }

  const clientName = clients.find(c => c.id === selectedClient)?.name || ''
  const imageAds = winningAds.filter(a => !a.isVideo)
  const hasAssets = brandColors.length > 0 || styleGuide || creativePrefs || hardRules
  const assetsCount = [brandColors.length > 0, !!styleGuide, !!creativePrefs, !!hardRules, !!visualTone].filter(Boolean).length

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[20px] font-semibold text-[#111113]">Creative Studio</h1>
          <p className="text-[12px] text-[#9d9da8] mt-0.5">
            {selectedClient ? `Generating for ${clientName}` : 'Select a winning ad to generate variations automatically'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedClient}
            onChange={e => setSelectedClient(e.target.value)}
            className="px-3 py-1.5 rounded border border-[#e8e8ec] text-[13px] text-[#111113] bg-white min-w-[200px]"
          >
            <option value="">Select client...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {selectedClient && (
            <div className="flex items-center border border-[#e8e8ec] rounded overflow-hidden">
              {(['generate', 'gallery', 'settings'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  className={`px-3 py-1.5 text-[11px] font-medium border-r border-[#e8e8ec] last:border-r-0 transition-colors ${
                    viewMode === v ? 'bg-[#111113] text-white' : 'bg-white text-[#9d9da8] hover:text-[#111113]'
                  }`}
                >
                  {v === 'generate' ? 'Generate' : v === 'gallery' ? `Gallery (${history.length})` : `Brand ${hasAssets ? `(${assetsCount}/5)` : ''}`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {!selectedClient && (
        <div className="border border-dashed border-[#e8e8ec] rounded-md p-12 text-center">
          <p className="text-[14px] text-[#9d9da8]">Select a client to start generating creatives</p>
        </div>
      )}

      {/* ══════════ GENERATE VIEW ══════════ */}
      {selectedClient && viewMode === 'generate' && (
        <div className="space-y-6">
          {/* Brand context banner */}
          {assetsLoaded && !hasAssets && (
            <div className="bg-[#fef9c3] border border-[#fde68a] rounded-md px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-[12px] text-[#92400e]">No brand assets configured for {clientName}. Auto-detect from winning ads or set up manually.</p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={autoConfigure} disabled={autoConfiguring}
                  className="px-3 py-1.5 rounded bg-[#111113] text-white text-[11px] font-medium hover:bg-[#2a2a2e] disabled:opacity-50 transition-colors">
                  {autoConfiguring ? 'Analyzing ads...' : 'Auto-Configure from Winners'}
                </button>
                <button onClick={() => setViewMode('settings')} className="text-[11px] font-medium text-[#92400e] hover:text-[#78350f] underline">Manual</button>
              </div>
            </div>
          )}

          {/* Step 1: Select Winner */}
          <div className="border border-[#e8e8ec] rounded-md bg-white">
            <div className="px-4 py-3 border-b border-[#e8e8ec] flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-semibold text-[#111113]">Select a Winning Ad</h3>
                <p className="text-[11px] text-[#9d9da8] mt-0.5">Top performers from the last 60 days, ranked by CPR</p>
              </div>
              <span className="text-[10px] text-[#9d9da8]">{imageAds.length} image ads</span>
            </div>
            {loadingAds ? (
              <div className="p-6 text-[12px] text-[#9d9da8] text-center">Loading winning ads...</div>
            ) : imageAds.length === 0 ? (
              <div className="p-6 text-[12px] text-[#9d9da8] text-center">No winning image ads found</div>
            ) : (
              <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {imageAds.map((ad, i) => (
                  <button
                    key={ad.platformAdId}
                    onClick={() => selectWinner(ad)}
                    className={`relative rounded-md overflow-hidden border-2 transition-all text-left ${
                      selectedWinner?.platformAdId === ad.platformAdId
                        ? 'border-[#2563eb] ring-2 ring-[#2563eb]/20'
                        : additionalRefs.has(ad.platformAdId) ? 'border-[#16a34a] ring-1 ring-[#16a34a]/20'
                        : 'border-transparent hover:border-[#e8e8ec]'
                    }`}
                  >
                    <div className="aspect-square bg-[#f8f8fa] relative">
                      <img src={ad.imageUrl} alt={ad.name} className="w-full h-full object-cover" />
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/70 text-white text-[9px] font-bold rounded">#{i + 1}</div>
                      {selectedWinner?.platformAdId === ad.platformAdId && (
                        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-[#2563eb] text-white text-[9px] font-bold rounded">SELECTED</div>
                      )}
                      {additionalRefs.has(ad.platformAdId) && (
                        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-[#16a34a] text-white text-[9px] font-bold rounded">REF</div>
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

          {/* Step 2: Generate (only if winner selected) */}
          {selectedWinner && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Selected winner + refs (4 cols) */}
              <div className="lg:col-span-4 space-y-4">
                <div className="border border-[#2563eb] rounded-md bg-white overflow-hidden">
                  <div className="px-4 py-2 bg-[#2563eb]/5 border-b border-[#2563eb]/20 flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-[#2563eb]">STYLE ANCHOR</p>
                    <p className="text-[10px] text-[#2563eb]/60">{selectedWinner.ctr.toFixed(2)}% CTR</p>
                  </div>
                  <div className="aspect-square bg-[#f8f8fa]">
                    <img src={selectedWinner.imageUrl} alt={selectedWinner.name} className="w-full h-full object-contain" />
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-[12px] font-semibold text-[#111113] truncate">{selectedWinner.name}</p>
                    <div className="flex gap-3 text-[10px] text-[#9d9da8]">
                      <span>${selectedWinner.cpr.toFixed(2)} CPR</span>
                      <span>{selectedWinner.results} results</span>
                      <span>${selectedWinner.spend.toFixed(0)} spent</span>
                    </div>
                    {selectedWinner.headline && <p className="text-[11px] text-[#6b6b76] italic truncate">"{selectedWinner.headline}"</p>}
                  </div>
                </div>

                {/* Additional refs */}
                {imageAds.length > 1 && (
                  <div className="border border-[#e8e8ec] rounded-md bg-white">
                    <div className="px-4 py-2 border-b border-[#e8e8ec] flex items-center justify-between">
                      <p className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider">Additional References</p>
                      <span className="text-[10px] text-[#9d9da8]">{additionalRefs.size}/5</span>
                    </div>
                    <div className="p-2 grid grid-cols-4 gap-1.5 max-h-[180px] overflow-y-auto">
                      {imageAds.filter(a => a.platformAdId !== selectedWinner.platformAdId).map(ad => (
                        <button key={ad.platformAdId} onClick={() => toggleAdditionalRef(ad.platformAdId)}
                          className={`relative aspect-square rounded overflow-hidden border-2 transition-all ${
                            additionalRefs.has(ad.platformAdId) ? 'border-[#16a34a]' : 'border-transparent hover:border-[#e8e8ec]'
                          }`}>
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

                {/* Upload client photos */}
                <div className="border border-[#e8e8ec] rounded-md bg-white">
                  <div className="px-4 py-2 border-b border-[#e8e8ec] flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider">Client Photos</p>
                      <p className="text-[10px] text-[#9d9da8]">Use real photos in the ad</p>
                    </div>
                    <span className="text-[10px] text-[#9d9da8]">{uploadedImages.length}/6</span>
                  </div>
                  <div className="p-3">
                    {uploadedImages.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {uploadedImages.map((img, i) => (
                          <div key={i} className="relative aspect-square rounded overflow-hidden border border-[#e8e8ec] group">
                            <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                            <button onClick={() => removeUpload(i)}
                              className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                              <p className="text-[8px] text-white truncate">{img.name}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={e => handleFileUpload(e.target.files)} className="hidden" />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || uploadedImages.length >= 6}
                      className="w-full py-2.5 border border-dashed border-[#e8e8ec] rounded text-[11px] text-[#9d9da8] hover:text-[#111113] hover:border-[#2563eb] transition-colors disabled:opacity-50"
                    >
                      {uploading ? 'Uploading...' : uploadedImages.length >= 6 ? 'Max 6 photos' : 'Upload Photos'}
                    </button>
                    {uploadedImages.length > 0 && (
                      <p className="text-[10px] text-[#2563eb] mt-1.5">The winning ad's layout will be used as a template with your photos as the hero visual</p>
                    )}
                  </div>
                </div>

                {/* Brand context summary */}
                {hasAssets && (
                  <div className="border border-[#e8e8ec] rounded-md bg-white p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider">Brand Context</p>
                      <button onClick={() => setViewMode('settings')} className="text-[10px] text-[#2563eb] hover:text-[#1d4ed8]">Edit</button>
                    </div>
                    {brandColors.length > 0 && (
                      <div className="flex gap-1 mb-2">
                        {brandColors.map((c, i) => (
                          <div key={i} className="w-6 h-6 rounded border border-[#e8e8ec]" style={{ backgroundColor: c.hex }} title={`${c.name}: ${c.hex}`} />
                        ))}
                      </div>
                    )}
                    {visualTone && <p className="text-[10px] text-[#6b6b76] mb-1">{visualTone}</p>}
                    <p className="text-[10px] text-[#9d9da8]">{assetsCount}/5 brand settings configured</p>
                  </div>
                )}
              </div>

              {/* Right: Controls + Output (8 cols) */}
              <div className="lg:col-span-8 space-y-4">
                {/* Controls bar */}
                <div className="border border-[#e8e8ec] rounded-md bg-white p-4">
                  <div className="flex flex-wrap gap-4 items-end">
                    <div>
                      <label className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider block mb-2">Mode</label>
                      <div className="flex gap-2">
                        <button onClick={() => setMode('variation')}
                          className={`px-3 py-1.5 rounded border text-[12px] font-medium transition-colors ${mode === 'variation' ? 'border-[#2563eb] bg-[#2563eb]/5 text-[#2563eb]' : 'border-[#e8e8ec] text-[#111113]'}`}>
                          Variation
                        </button>
                        <button onClick={() => setMode('refresh')}
                          className={`px-3 py-1.5 rounded border text-[12px] font-medium transition-colors ${mode === 'refresh' ? 'border-[#f59e0b] bg-[#f59e0b]/5 text-[#f59e0b]' : 'border-[#e8e8ec] text-[#111113]'}`}>
                          Refresh
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider block mb-2">Ratio</label>
                      <div className="flex gap-1">
                        {ASPECT_RATIOS.map(ar => (
                          <button key={ar.value} onClick={() => setAspectRatio(ar.value)} title={ar.desc}
                            className={`px-2.5 py-1.5 rounded border text-[11px] font-medium transition-colors ${aspectRatio === ar.value ? 'border-[#2563eb] bg-[#2563eb]/5 text-[#2563eb]' : 'border-[#e8e8ec] text-[#111113]'}`}>
                            {ar.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider block mb-2">Quality</label>
                      <div className="flex gap-1">
                        {['1K', '2K', '4K'].map(r => (
                          <button key={r} onClick={() => setResolution(r)}
                            className={`px-2.5 py-1.5 rounded border text-[11px] font-medium transition-colors ${resolution === r ? 'border-[#2563eb] bg-[#2563eb]/5 text-[#2563eb]' : 'border-[#e8e8ec] text-[#111113]'}`}>
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={generate} disabled={generating}
                      className="px-6 py-2 rounded bg-[#2563eb] text-white text-[13px] font-medium hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors ml-auto">
                      {generating ? 'Generating...' : mode === 'refresh' ? 'Generate Refresh' : 'Generate Variation'}
                    </button>
                  </div>
                  {/* Additional direction */}
                  <div className="mt-3">
                    <button onClick={() => setShowAdvanced(!showAdvanced)}
                      className="text-[11px] text-[#9d9da8] hover:text-[#111113] transition-colors flex items-center gap-1">
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`}><path d="M6 4l4 4-4 4" /></svg>
                      Additional direction (optional)
                    </button>
                    {showAdvanced && (
                      <textarea value={direction} onChange={e => setDirection(e.target.value)} rows={3}
                        placeholder="e.g. 'Use a before/after split', 'Focus on the pricing angle', 'Show the service being performed', 'Make the headline about winter specials'"
                        className="w-full mt-2 px-3 py-2 rounded border border-[#e8e8ec] text-[12px] text-[#111113] placeholder:text-[#9d9da8] resize-none focus:outline-none focus:border-[#2563eb]" />
                    )}
                  </div>
                </div>

                {/* Activity Log */}
                {logEntries.length > 0 && (
                  <div className="border border-[#e8e8ec] rounded-md bg-white overflow-hidden">
                    <div className="px-4 py-2 border-b border-[#e8e8ec] bg-[#f8f8fa] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider">Generation Log</span>
                        {generating && <div className="w-1.5 h-1.5 bg-[#2563eb] rounded-full animate-pulse" />}
                      </div>
                      {!generating && (
                        <button onClick={() => setLogEntries([])} className="text-[10px] text-[#9d9da8] hover:text-[#111113] transition-colors">Clear</button>
                      )}
                    </div>
                    <div className="divide-y divide-[#f4f4f6] max-h-[200px] overflow-y-auto">
                      {logEntries.map((entry, i) => (
                        <div key={i} className="px-4 py-1.5 flex items-start gap-2.5">
                          <span className="text-[10px] text-[#9d9da8] font-mono flex-shrink-0 mt-0.5 w-[52px]">{entry.time}</span>
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                            entry.type === 'success' ? 'bg-[#16a34a]' :
                            entry.type === 'warning' ? 'bg-[#f59e0b]' :
                            entry.type === 'error' ? 'bg-[#dc2626]' :
                            i === logEntries.length - 1 && generating ? 'bg-[#2563eb] animate-pulse' : 'bg-[#9d9da8]'
                          }`} />
                          <span className={`text-[11px] leading-relaxed ${
                            entry.type === 'error' ? 'text-[#dc2626]' :
                            entry.type === 'warning' ? 'text-[#92400e]' :
                            entry.type === 'success' ? 'text-[#166534]' :
                            'text-[#111113]'
                          }`}>{entry.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && <div className="bg-[#fef2f2] border border-[#fecaca] rounded-md p-3 text-[12px] text-[#dc2626]">{error}</div>}

                {/* ═══ SIDE BY SIDE: Winner vs Generated ═══ */}
                {generatedImage && !generating && (
                  <div ref={outputRef} className="border border-[#e8e8ec] rounded-md bg-white overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#e8e8ec] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[13px] font-semibold text-[#111113]">Result</h3>
                        {qaResult && (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${qaResult.pass ? 'bg-[#16a34a]/10 text-[#16a34a]' : 'bg-[#f59e0b]/10 text-[#f59e0b]'}`}>
                            {qaResult.pass ? 'QA Passed' : `QA: ${qaResult.issues.join(', ')}`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={generate}
                          className="px-3 py-1 rounded border border-[#e8e8ec] text-[11px] font-medium text-[#111113] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors">
                          Regenerate
                        </button>
                        <button onClick={() => downloadImage(generatedImage, `${clientName}-${mode}`)}
                          className="px-3 py-1 rounded border border-[#e8e8ec] text-[11px] font-medium text-[#111113] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors">
                          Download
                        </button>
                      </div>
                    </div>

                    {/* Side-by-side comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2">
                      <div className="border-b md:border-b-0 md:border-r border-[#e8e8ec]">
                        <div className="px-3 py-1.5 bg-[#f8f8fa] border-b border-[#e8e8ec]">
                          <p className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider">Original Winner</p>
                        </div>
                        <div className="p-3 flex justify-center bg-[#fafafa]">
                          <img src={selectedWinner.imageUrl} alt="Winner" className="max-w-full max-h-[400px] object-contain rounded" />
                        </div>
                      </div>
                      <div>
                        <div className="px-3 py-1.5 bg-[#f8f8fa] border-b border-[#e8e8ec]">
                          <p className="text-[10px] font-semibold text-[#2563eb] uppercase tracking-wider">Generated {mode === 'refresh' ? 'Refresh' : 'Variation'}</p>
                        </div>
                        <div className="p-3 flex justify-center bg-[#fafafa]">
                          <img src={generatedImage} alt="Generated" className="max-w-full max-h-[400px] object-contain rounded" />
                        </div>
                      </div>
                    </div>

                    {/* Model notes */}
                    {modelNotes && (
                      <div className="px-4 py-3 border-t border-[#e8e8ec]">
                        <p className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider mb-1">Model Notes</p>
                        <p className="text-[12px] text-[#111113] whitespace-pre-line">{stripMarkdown(modelNotes)}</p>
                      </div>
                    )}

                    {/* Feedback */}
                    <div className="px-4 py-3 border-t border-[#e8e8ec]">
                      {!showFeedback ? (
                        <button onClick={() => setShowFeedback(true)} className="text-[12px] text-[#2563eb] hover:text-[#1d4ed8] font-medium transition-colors">
                          Give feedback and regenerate
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider block">What should change?</label>
                          <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3} autoFocus
                            placeholder="e.g. 'Make the headline larger', 'Use warmer colors', 'The text is hard to read', 'Try a different angle'"
                            className="w-full px-3 py-2 rounded border border-[#e8e8ec] text-[12px] text-[#111113] placeholder:text-[#9d9da8] resize-none focus:outline-none focus:border-[#2563eb]" />
                          <div className="flex items-center gap-2">
                            <button disabled={!feedback.trim() || generating}
                              onClick={() => { setDirection(prev => prev ? `${prev}\n\nFEEDBACK ON PREVIOUS VERSION: ${feedback}` : `FEEDBACK ON PREVIOUS VERSION: ${feedback}`); setShowFeedback(false); setFeedback(''); generate() }}
                              className="px-4 py-1.5 rounded bg-[#2563eb] text-white text-[12px] font-medium hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors">
                              Regenerate with Feedback
                            </button>
                            <button onClick={() => { setShowFeedback(false); setFeedback('') }}
                              className="px-3 py-1.5 rounded border border-[#e8e8ec] text-[12px] text-[#9d9da8] hover:text-[#111113] transition-colors">Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Winner analysis (collapsed, below output) */}
                {winnerAnalysis && (
                  <details className="border border-[#e8e8ec] rounded-md bg-white" open={generating && !generatedImage}>
                    <summary className="px-4 py-2 border-b border-[#e8e8ec] bg-[#f8f8fa] cursor-pointer">
                      <span className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider">Winner Analysis</span>
                    </summary>
                    <div className="p-4 text-[12px] text-[#111113] leading-relaxed whitespace-pre-line">{stripMarkdown(winnerAnalysis)}</div>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ GALLERY VIEW ══════════ */}
      {selectedClient && viewMode === 'gallery' && (
        <div>
          {history.length === 0 ? (
            <div className="border border-dashed border-[#e8e8ec] rounded-md p-12 text-center">
              <p className="text-[14px] text-[#9d9da8]">No creatives generated yet for {clientName}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {history.map(c => (
                  <div key={c.id} onClick={() => setPreviewCreative(c)}
                    className="border border-[#e8e8ec] rounded-md overflow-hidden bg-white group cursor-pointer hover:border-[#2563eb]/30 transition-colors">
                    <div className="aspect-square bg-[#f8f8fa] relative">
                      {c.image_data ? <img src={c.image_data} alt={c.concept || ''} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-[11px] text-[#9d9da8]">No preview</div>}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      {c.metadata?.mode === 'refresh' && <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-[#f59e0b] text-white text-[9px] font-bold rounded">REFRESH</div>}
                      {c.metadata?.qaPass === false && <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-[#f59e0b] text-white text-[9px] font-bold rounded">QA</div>}
                    </div>
                    <div className="p-3">
                      <p className="text-[12px] font-semibold text-[#111113] truncate">{c.concept || 'Untitled'}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-[#9d9da8]">{c.aspect_ratio} / {c.resolution}</span>
                        <span className="text-[10px] text-[#9d9da8]">{formatTimeAgo(c.created_at)}</span>
                      </div>
                      {c.metadata?.winnerName && <p className="text-[10px] text-[#9d9da8] mt-0.5 truncate">From: {c.metadata.winnerName}</p>}
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
                        <details>
                          <summary className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider mb-1 cursor-pointer">Winner Analysis</summary>
                          <p className="text-[12px] text-[#111113] whitespace-pre-line leading-relaxed mt-2">{stripMarkdown(previewCreative.metadata.winnerAnalysis)}</p>
                        </details>
                      )}
                      <div className="flex flex-wrap gap-4">
                        {previewCreative.metadata?.winnerName && <div><p className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider">Based On</p><p className="text-[12px] text-[#111113]">{previewCreative.metadata.winnerName}</p></div>}
                        <div><p className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider">Mode</p><p className="text-[12px] text-[#111113]">{previewCreative.metadata?.mode || 'variation'}</p></div>
                        <div><p className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider">Ratio</p><p className="text-[12px] text-[#111113]">{previewCreative.aspect_ratio}</p></div>
                        <div><p className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider">Quality</p><p className="text-[12px] text-[#111113]">{previewCreative.resolution}</p></div>
                        <div><p className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider">Generated</p><p className="text-[12px] text-[#111113]">{new Date(previewCreative.created_at).toLocaleString()}</p></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════ BRAND SETTINGS VIEW ══════════ */}
      {selectedClient && viewMode === 'settings' && (
        <div className="max-w-[800px]">
          <div className="border border-[#e8e8ec] rounded-md bg-white">
            <div className="px-5 py-4 border-b border-[#e8e8ec]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[14px] font-semibold text-[#111113]">Brand Assets for {clientName}</h2>
                  <p className="text-[11px] text-[#9d9da8] mt-0.5">These settings are automatically applied when generating creatives</p>
                </div>
                <button onClick={autoConfigure} disabled={autoConfiguring}
                  className="px-3 py-1.5 rounded border border-[#e8e8ec] text-[11px] font-medium text-[#111113] hover:border-[#2563eb] hover:text-[#2563eb] disabled:opacity-50 transition-colors flex-shrink-0">
                  {autoConfiguring ? 'Analyzing...' : 'Auto-Detect from Winners'}
                </button>
              </div>
            </div>
            <div className="p-5 space-y-6">
              {/* Colors */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider">Brand Colors</label>
                  <button onClick={addColor} className="text-[11px] text-[#2563eb] hover:text-[#1d4ed8] font-medium">+ Add Color</button>
                </div>
                {brandColors.length === 0 ? (
                  <p className="text-[11px] text-[#9d9da8] italic">No colors set. Add brand colors for consistent creative generation.</p>
                ) : (
                  <div className="space-y-2">
                    {brandColors.map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="color" value={c.hex} onChange={e => updateColor(i, 'hex', e.target.value)} className="w-9 h-9 rounded border border-[#e8e8ec] cursor-pointer p-0.5" />
                        <input value={c.hex} onChange={e => updateColor(i, 'hex', e.target.value)} placeholder="#000000" className="w-24 px-2 py-2 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[12px] text-[#111113] font-mono focus:outline-none focus:border-[#2563eb]" />
                        <input value={c.name} onChange={e => updateColor(i, 'name', e.target.value)} placeholder="e.g. Primary, Accent, CTA" className="flex-1 px-3 py-2 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[12px] text-[#111113] focus:outline-none focus:border-[#2563eb]" />
                        <button onClick={() => removeColor(i)} className="text-[#9d9da8] hover:text-[#dc2626] transition-colors p-1">
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Visual Tone */}
              <div>
                <label className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider block mb-1">Visual Tone</label>
                <input value={visualTone} onChange={e => setVisualTone(e.target.value)} placeholder="e.g. Natural & candid, Bold & modern, Cinematic & premium"
                  className="w-full px-3 py-2 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[13px] text-[#111113] focus:outline-none focus:border-[#2563eb]" />
              </div>
              {/* Style Guide */}
              <div>
                <label className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider block mb-1">Style Guide</label>
                <textarea value={styleGuide} onChange={e => setStyleGuide(e.target.value)} rows={4}
                  placeholder="Photography direction, typography preferences, layout rules, lighting notes..."
                  className="w-full px-3 py-2 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[13px] text-[#111113] resize-none focus:outline-none focus:border-[#2563eb]" />
              </div>
              {/* Creative Preferences */}
              <div>
                <label className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider block mb-1">Creative Preferences</label>
                <textarea value={creativePrefs} onChange={e => setCreativePrefs(e.target.value)} rows={4}
                  placeholder="What works: full-bleed shots, natural lighting, candid feel...&#10;What doesn't: white backgrounds, stock photo vibes, dramatic lighting..."
                  className="w-full px-3 py-2 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[13px] text-[#111113] resize-none focus:outline-none focus:border-[#2563eb]" />
              </div>
              {/* Hard Rules */}
              <div>
                <label className="text-[10px] font-semibold text-[#9d9da8] uppercase tracking-wider block mb-1">Hard Rules</label>
                <textarea value={hardRules} onChange={e => setHardRules(e.target.value)} rows={3}
                  placeholder="e.g. MUST use LLumar branding, MUST NOT include XPEL, NO faces, NO logos"
                  className="w-full px-3 py-2 rounded bg-[#f8f8fa] border border-[#e8e8ec] text-[13px] text-[#111113] resize-none focus:outline-none focus:border-[#2563eb]" />
              </div>
              {/* Save */}
              <button onClick={saveBrandAssets} disabled={savingAssets}
                className="w-full py-2.5 rounded bg-[#111113] text-white text-[13px] font-medium hover:bg-[#2a2a2e] disabled:opacity-50 transition-colors">
                {savingAssets ? 'Saving...' : assetsSaved ? 'Saved' : 'Save Brand Assets'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function now(): string {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function stripMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/#{1,4}\s*/g, '').replace(/`(.+?)`/g, '$1').replace(/^\s*[-*]\s+/gm, '- ').replace(/\n{3,}/g, '\n\n').trim()
}

function formatTimeAgo(dateStr: string): string {
  const hours = Math.round((Date.now() - new Date(dateStr).getTime()) / 3600000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}
