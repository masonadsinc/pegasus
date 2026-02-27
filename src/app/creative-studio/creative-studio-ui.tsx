'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Client { id: string; name: string; slug: string }

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  imageData?: string
  imageMime?: string
  status?: string
  timestamp: string
}

interface GeneratedCreative {
  id: string; prompt: string; concept: string | null; aspect_ratio: string
  resolution: string; image_data: string; metadata: any; source?: string; client_id?: string; created_at: string
}

interface BrandColor { name: string; hex: string }

const ASPECT_RATIOS = [
  { label: '1:1', value: '1:1', desc: 'Feed' },
  { label: '4:5', value: '4:5', desc: 'Portrait' },
  { label: '9:16', value: '9:16', desc: 'Stories' },
  { label: '16:9', value: '16:9', desc: 'Landscape' },
]

function now() { return new Date().toISOString() }

export function CreativeStudioUI({ clients, initialClientId }: { clients: Client[]; initialClientId?: string }) {
  const [selectedClient, setSelectedClient] = useState(initialClientId || '')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [resolution, setResolution] = useState('2K')
  const [history, setHistory] = useState<GeneratedCreative[]>([])
  const [viewMode, setViewMode] = useState<'chat' | 'gallery' | 'settings'>('chat')
  const [previewCreative, setPreviewCreative] = useState<GeneratedCreative | null>(null)
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
  const [uploadedImages, setUploadedImages] = useState<{ name: string; dataUrl: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (selectedClient) {
      loadHistory()
      loadBrandAssets()
      setMessages([{
        id: 'welcome',
        role: 'system',
        content: `Ready to generate images${clients.find(c => c.id === selectedClient)?.name ? ` for ${clients.find(c => c.id === selectedClient)?.name}` : ''}. Describe what you want and I'll create it.`,
        timestamp: now(),
      }])
      setUploadedImages([])
    } else {
      loadHistory()
      setMessages([{
        id: 'welcome-no-client',
        role: 'system',
        content: 'Describe any image and I\'ll generate it. Select a client to use their brand context.',
        timestamp: now(),
      }])
    }
  }, [selectedClient])

  // Set initial welcome
  useEffect(() => {
    if (!selectedClient) {
      setMessages([{
        id: 'welcome-init',
        role: 'system',
        content: 'Describe any image and I\'ll generate it. Select a client to use their brand context.',
        timestamp: now(),
      }])
    }
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadHistory() {
    try {
      const url = selectedClient ? `/api/creative-studio/history?clientId=${selectedClient}` : '/api/creative-studio/history'
      const res = await fetch(url)
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

  async function handleFileUpload(files: FileList | null) {
    if (!files?.length) return
    const formData = new FormData()
    for (let i = 0; i < Math.min(files.length, 6 - uploadedImages.length); i++) {
      formData.append('images', files[i])
    }
    try {
      const res = await fetch('/api/creative-studio/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.images) setUploadedImages(prev => [...prev, ...data.images].slice(0, 6))
    } catch {}
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSend() {
    const prompt = input.trim()
    if (!prompt || generating) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      timestamp: now(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setGenerating(true)

    // Add a placeholder assistant message for status updates
    const assistantId = crypto.randomUUID()
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      status: 'Starting generation...',
      timestamp: now(),
    }
    setMessages(prev => [...prev, assistantMsg])

    try {
      const res = await fetch('/api/creative-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient || undefined,
          manualPrompt: prompt,
          mode: 'manual',
          aspectRatio,
          resolution,
          uploadedImages: uploadedImages.map(img => img.dataUrl),
          source: 'image-studio-chat',
        }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalImageData = ''
      let finalNotes = ''
      let qaResult: any = null

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
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, status: data.message } : m
              ))
            } else if (data.type === 'error') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: `Generation failed: ${data.message}`, status: undefined } : m
              ))
            } else if (data.type === 'complete') {
              finalImageData = data.imageData || ''
              finalNotes = data.modelNotes || ''
              qaResult = data.qa
              // Strip markdown from notes
              const cleanNotes = finalNotes
                .replace(/\*\*(.*?)\*\*/g, '$1')
                .replace(/\*(.*?)\*/g, '$1')
                .replace(/#{1,3}\s/g, '')
                .trim()
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? {
                  ...m,
                  content: cleanNotes || 'Here\'s what I generated:',
                  imageData: finalImageData,
                  status: undefined,
                } : m
              ))
              setUploadedImages([])
              await loadHistory()
            }
          } catch {}
        }
      }
    } catch (e: any) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: `Error: ${e.message || 'Generation failed'}`, status: undefined } : m
      ))
    }
    setGenerating(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function downloadImage(dataUrl: string, name: string) {
    const a = document.createElement('a'); a.href = dataUrl; a.download = `${name || 'creative'}.png`; a.click()
  }

  async function deleteCreative(id: string) {
    await fetch('/api/creative-studio/history', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setHistory(prev => prev.filter(c => c.id !== id))
    if (previewCreative?.id === id) setPreviewCreative(null)
  }

  const clientName = clients.find(c => c.id === selectedClient)?.name || ''
  const hasAssets = brandColors.length > 0 || styleGuide || creativePrefs || hardRules
  const assetsCount = [brandColors.length > 0, !!styleGuide, !!creativePrefs, !!hardRules, !!visualTone].filter(Boolean).length

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-[20px] font-semibold text-[#111113]">Image Studio</h1>
          <p className="text-[12px] text-[#9d9da8] mt-0.5">
            {selectedClient ? `Generating for ${clientName}` : 'Describe any image to generate it'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedClient}
            onChange={e => setSelectedClient(e.target.value)}
            className="px-3 py-1.5 rounded border border-[#e8e8ec] text-[13px] text-[#111113] bg-white min-w-[200px]"
          >
            <option value="">No client (freestyle)</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {selectedClient && (
            <div className="flex items-center border border-[#e8e8ec] rounded overflow-hidden">
              {(['chat', 'gallery', 'settings'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  className={`px-3 py-1.5 text-[11px] font-medium border-r border-[#e8e8ec] last:border-r-0 transition-colors ${
                    viewMode === v ? 'bg-[#111113] text-white' : 'bg-white text-[#9d9da8] hover:text-[#111113]'
                  }`}
                >
                  {v === 'chat' ? 'Generate' : v === 'gallery' ? `Gallery (${history.length})` : `Brand ${hasAssets ? `(${assetsCount}/5)` : ''}`}
                </button>
              ))}
            </div>
          )}
          {!selectedClient && history.length > 0 && (
            <button onClick={() => setViewMode(viewMode === 'gallery' ? 'chat' : 'gallery')}
              className={`px-3 py-1.5 text-[11px] font-medium rounded border border-[#e8e8ec] transition-colors ${viewMode === 'gallery' ? 'bg-[#111113] text-white' : 'bg-white text-[#9d9da8] hover:text-[#111113]'}`}>
              Gallery ({history.length})
            </button>
          )}
        </div>
      </div>

      {/* ══════════ CHAT VIEW ══════════ */}
      {viewMode === 'chat' && (
        <div className="border border-[#e8e8ec] rounded-md bg-white flex flex-col" style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
          {/* Settings bar */}
          <div className="px-4 py-2.5 border-b border-[#e8e8ec] flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#9d9da8] uppercase tracking-wider">Ratio</span>
              {ASPECT_RATIOS.map(r => (
                <button key={r.value} onClick={() => setAspectRatio(r.value)}
                  className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                    aspectRatio === r.value ? 'bg-[#111113] text-white' : 'bg-[#f4f4f6] text-[#6b6b76] hover:bg-[#e8e8ec]'
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#9d9da8] uppercase tracking-wider">Quality</span>
              {['1K', '2K'].map(r => (
                <button key={r} onClick={() => setResolution(r)}
                  className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                    resolution === r ? 'bg-[#111113] text-white' : 'bg-[#f4f4f6] text-[#6b6b76] hover:bg-[#e8e8ec]'
                  }`}>
                  {r}
                </button>
              ))}
            </div>
            {selectedClient && assetsLoaded && hasAssets && (
              <span className="text-[10px] text-[#16a34a] ml-auto">Brand context active</span>
            )}
            {selectedClient && assetsLoaded && !hasAssets && (
              <button onClick={() => setViewMode('settings')} className="text-[10px] text-[#f59e0b] ml-auto hover:underline">
                No brand assets — configure
              </button>
            )}
            {!selectedClient && (
              <span className="text-[10px] text-[#9d9da8] ml-auto">Freestyle mode — no brand context</span>
            )}
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'system' ? (
                  <div className="text-center w-full py-2">
                    <p className="text-[11px] text-[#9d9da8]">{msg.content}</p>
                  </div>
                ) : msg.role === 'user' ? (
                  <div className="max-w-[70%]">
                    <div className="bg-[#111113] text-white rounded-md rounded-br-none px-4 py-2.5">
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <p className="text-[10px] text-[#9d9da8] mt-1 text-right">
                      {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                ) : (
                  <div className="max-w-[80%]">
                    {msg.status && (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 border-2 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
                        <p className="text-[12px] text-[#6b6b76]">{msg.status}</p>
                      </div>
                    )}
                    {msg.imageData && (
                      <div className="mb-2 group relative">
                        <img
                          src={msg.imageData}
                          alt="Generated"
                          className="rounded-md max-w-full max-h-[500px] object-contain border border-[#e8e8ec]"
                        />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5">
                          <button onClick={() => downloadImage(msg.imageData!, 'image-studio')}
                            className="bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-medium text-[#111113] hover:bg-white shadow-sm">
                            Download
                          </button>
                        </div>
                      </div>
                    )}
                    {msg.content && !msg.status && (
                      <div className="bg-[#f4f4f6] rounded-md rounded-bl-none px-4 py-2.5">
                        <p className="text-[13px] text-[#111113] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    )}
                    {!msg.status && (
                      <p className="text-[10px] text-[#9d9da8] mt-1">
                        {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Uploaded images preview */}
          {uploadedImages.length > 0 && (
            <div className="px-4 py-2 border-t border-[#e8e8ec] bg-[#fafafb]">
              <div className="flex items-center gap-2 overflow-x-auto">
                <span className="text-[10px] text-[#9d9da8] flex-shrink-0">Attached:</span>
                {uploadedImages.map((img, i) => (
                  <div key={i} className="relative flex-shrink-0">
                    <img src={img.dataUrl} className="w-10 h-10 rounded object-cover border border-[#e8e8ec]" />
                    <button onClick={() => setUploadedImages(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-[#dc2626] text-white rounded-full text-[9px] flex items-center justify-center">
                      x
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="px-4 py-3 border-t border-[#e8e8ec] bg-[#fafafb]">
            <div className="flex items-end gap-2">
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple
                onChange={e => handleFileUpload(e.target.files)} />
              <button onClick={() => fileInputRef.current?.click()} disabled={generating || uploadedImages.length >= 6}
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded border border-[#e8e8ec] bg-white text-[#9d9da8] hover:text-[#111113] hover:border-[#111113] transition-colors disabled:opacity-40"
                title="Attach reference images">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={generating ? 'Generating...' : 'Describe the image you want to create...'}
                disabled={generating}
                rows={1}
                className="flex-1 resize-none rounded border border-[#e8e8ec] bg-white px-3 py-2 text-[13px] text-[#111113] placeholder:text-[#9d9da8] focus:outline-none focus:border-[#111113] disabled:opacity-50 max-h-[120px]"
                style={{ minHeight: '36px' }}
                onInput={e => {
                  const t = e.target as HTMLTextAreaElement
                  t.style.height = 'auto'
                  t.style.height = Math.min(t.scrollHeight, 120) + 'px'
                }}
              />
              <button onClick={handleSend} disabled={!input.trim() || generating}
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded bg-[#111113] text-white hover:bg-[#2a2a2e] disabled:opacity-40 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ GALLERY VIEW ══════════ */}
      {viewMode === 'gallery' && (
        <div>
          {history.length === 0 ? (
            <div className="border border-dashed border-[#e8e8ec] rounded-md p-12 text-center">
              <p className="text-[14px] text-[#9d9da8]">No generated images yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {history.map(creative => (
                <div key={creative.id} className="group relative border border-[#e8e8ec] rounded-md overflow-hidden bg-white">
                  <div className="cursor-pointer" onClick={() => setPreviewCreative(creative)}>
                    <img src={creative.image_data} alt={creative.concept || 'Generated'} className="w-full aspect-square object-cover" />
                  </div>
                  <div className="p-2.5">
                    <p className="text-[11px] text-[#111113] font-medium truncate">{creative.concept || creative.prompt?.substring(0, 40) || 'Generated'}</p>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-[#9d9da8]">{creative.aspect_ratio}</span>
                        {creative.source && creative.source !== 'creative-studio' && (
                          <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${
                            creative.source === 'copywriter' ? 'bg-[#ede9fe] text-[#7c3aed]' :
                            creative.source === 'pegasus-chat' ? 'bg-[#e0f2fe] text-[#0284c7]' :
                            'bg-[#f4f4f6] text-[#6b6b76]'
                          }`}>{creative.source === 'copywriter' ? 'Copy' : creative.source === 'pegasus-chat' ? 'Pegasus' : creative.source}</span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#9d9da8]">{new Date(creative.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button onClick={() => downloadImage(creative.image_data, creative.concept || 'creative')}
                      className="bg-white/90 backdrop-blur w-7 h-7 flex items-center justify-center rounded text-[#111113] shadow-sm hover:bg-white">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </button>
                    <button onClick={() => deleteCreative(creative.id)}
                      className="bg-white/90 backdrop-blur w-7 h-7 flex items-center justify-center rounded text-[#dc2626] shadow-sm hover:bg-white">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Preview modal */}
          {previewCreative && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setPreviewCreative(null)}>
              <div className="bg-white rounded-md max-w-[900px] w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col md:flex-row">
                  <div className="md:w-[55%] bg-[#f4f4f6] flex items-center justify-center p-4">
                    <img src={previewCreative.image_data} alt="" className="max-w-full max-h-[60vh] object-contain" />
                  </div>
                  <div className="md:w-[45%] p-5">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-[14px] font-semibold text-[#111113]">{previewCreative.concept || 'Generated Creative'}</h3>
                      <button onClick={() => setPreviewCreative(null)} className="text-[#9d9da8] hover:text-[#111113]">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <div className="space-y-2 text-[12px] text-[#6b6b76]">
                      <p><span className="text-[#9d9da8]">Ratio:</span> {previewCreative.aspect_ratio}</p>
                      <p><span className="text-[#9d9da8]">Resolution:</span> {previewCreative.resolution}</p>
                      <p><span className="text-[#9d9da8]">Created:</span> {new Date(previewCreative.created_at).toLocaleString()}</p>
                      {previewCreative.prompt && (
                        <div className="mt-3 pt-3 border-t border-[#e8e8ec]">
                          <p className="text-[10px] text-[#9d9da8] uppercase tracking-wider mb-1">Prompt</p>
                          <p className="text-[12px] text-[#6b6b76] whitespace-pre-wrap">{previewCreative.prompt}</p>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button onClick={() => downloadImage(previewCreative.image_data, previewCreative.concept || 'creative')}
                        className="px-3 py-1.5 rounded bg-[#111113] text-white text-[11px] font-medium hover:bg-[#2a2a2e]">
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ SETTINGS VIEW ══════════ */}
      {viewMode === 'settings' && selectedClient && (
        <div className="max-w-[700px]">
          <div className="border border-[#e8e8ec] rounded-md bg-white">
            <div className="px-4 py-3 border-b border-[#e8e8ec] flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-semibold text-[#111113]">Brand Assets — {clientName}</h3>
                <p className="text-[11px] text-[#9d9da8] mt-0.5">These settings are used automatically when generating images for this client</p>
              </div>
              <button onClick={autoConfigure} disabled={autoConfiguring}
                className="px-3 py-1.5 rounded border border-[#e8e8ec] text-[11px] font-medium text-[#6b6b76] hover:text-[#111113] disabled:opacity-50">
                {autoConfiguring ? 'Analyzing...' : 'Auto-Detect from Ads'}
              </button>
            </div>
            <div className="p-4 space-y-5">
              {/* Brand Colors */}
              <div>
                <label className="text-[11px] font-medium text-[#111113] block mb-2">Brand Colors</label>
                <div className="space-y-2">
                  {brandColors.map((color, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="color" value={color.hex} onChange={e => updateColor(i, 'hex', e.target.value)} className="w-8 h-8 rounded border border-[#e8e8ec] cursor-pointer" />
                      <input type="text" value={color.hex} onChange={e => updateColor(i, 'hex', e.target.value)}
                        className="w-24 px-2 py-1 rounded border border-[#e8e8ec] text-[12px] font-mono" />
                      <input type="text" value={color.name} onChange={e => updateColor(i, 'name', e.target.value)} placeholder="Name (e.g. Primary)"
                        className="flex-1 px-2 py-1 rounded border border-[#e8e8ec] text-[12px]" />
                      <button onClick={() => removeColor(i)} className="text-[#dc2626] hover:text-[#b91c1c] text-[12px]">Remove</button>
                    </div>
                  ))}
                  <button onClick={addColor} className="text-[11px] text-[#2563eb] hover:underline">+ Add color</button>
                </div>
              </div>

              {/* Visual Tone */}
              <div>
                <label className="text-[11px] font-medium text-[#111113] block mb-1">Visual Tone</label>
                <input type="text" value={visualTone} onChange={e => setVisualTone(e.target.value)} placeholder="e.g. Bold, masculine, premium — dark backgrounds with high contrast"
                  className="w-full px-3 py-1.5 rounded border border-[#e8e8ec] text-[12px]" />
              </div>

              {/* Style Guide */}
              <div>
                <label className="text-[11px] font-medium text-[#111113] block mb-1">Style Guide</label>
                <textarea value={styleGuide} onChange={e => setStyleGuide(e.target.value)} placeholder="Typography preferences, layout rules, imagery guidelines..."
                  rows={3} className="w-full px-3 py-1.5 rounded border border-[#e8e8ec] text-[12px] resize-none" />
              </div>

              {/* Creative Preferences */}
              <div>
                <label className="text-[11px] font-medium text-[#111113] block mb-1">Creative Preferences</label>
                <textarea value={creativePrefs} onChange={e => setCreativePrefs(e.target.value)} placeholder="What works well for this client's ads..."
                  rows={3} className="w-full px-3 py-1.5 rounded border border-[#e8e8ec] text-[12px] resize-none" />
              </div>

              {/* Hard Rules */}
              <div>
                <label className="text-[11px] font-medium text-[#111113] block mb-1">Hard Rules</label>
                <textarea value={hardRules} onChange={e => setHardRules(e.target.value)} placeholder="e.g. Never use competitor brand names, always include phone number..."
                  rows={2} className="w-full px-3 py-1.5 rounded border border-[#e8e8ec] text-[12px] resize-none" />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button onClick={saveBrandAssets} disabled={savingAssets}
                  className="px-4 py-2 rounded bg-[#111113] text-white text-[12px] font-medium hover:bg-[#2a2a2e] disabled:opacity-50">
                  {savingAssets ? 'Saving...' : assetsSaved ? 'Saved' : 'Save Brand Assets'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
