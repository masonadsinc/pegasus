'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Client {
  id: string
  name: string
  slug: string
  ad_accounts: { id: string; is_active: boolean; primary_action_type: string }[]
}

interface CopyBank {
  id: string
  period_days: number
  messaging_foundation: any
  status: string
  created_at: string
  raw_output: string
}

interface ImageAdSet {
  angle: string
  setNumber: number
  headline: string
  subHeadline: string
  cta: string
  visualConcept: string
  generating?: boolean
  imageData?: string
  error?: string
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*\*/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/###\s?/g, '')
    .replace(/##\s?/g, '')
    .replace(/#\s?/g, '')
    .replace(/`/g, '')
}

function parseSections(raw: string): { title: string; content: string }[] {
  if (!raw) return []
  const lines = raw.split('\n')
  const sections: { title: string; content: string }[] = []
  let currentTitle = ''
  let currentContent: string[] = []

  for (const line of lines) {
    const h2 = line.match(/^##\s+(?:SECTION \d+:\s*)?(.+)/i)
    if (h2) {
      if (currentTitle) sections.push({ title: stripMarkdown(currentTitle), content: currentContent.join('\n') })
      currentTitle = h2[1]
      currentContent = []
    } else {
      currentContent.push(line)
    }
  }
  if (currentTitle) sections.push({ title: stripMarkdown(currentTitle), content: currentContent.join('\n') })
  return sections
}

function parseImageAdSets(raw: string): ImageAdSet[] {
  if (!raw) return []
  const sets: ImageAdSet[] = []

  // Find the IMAGE AD TEXT section
  const iatMatch = raw.match(/IMAGE AD TEXT[\s\S]*?(?=##\s*SECTION 3|##\s*PRIMARY TEXT|$)/i)
  if (!iatMatch) return sets

  const section = iatMatch[0]

  // Split by angle headers (### Angle 1: Name)
  const angleBlocks = section.split(/###\s+/g).filter(Boolean)

  for (const block of angleBlocks) {
    const firstLine = block.split('\n')[0].trim()
    if (!firstLine.toLowerCase().includes('angle') && !firstLine.toLowerCase().includes('pain') && !firstLine.toLowerCase().includes('dream') && !firstLine.toLowerCase().includes('proof') && !firstLine.toLowerCase().includes('convenience') && !firstLine.toLowerCase().includes('quality') && !firstLine.toLowerCase().includes('lifestyle') && !firstLine.toLowerCase().includes('urgency') && !firstLine.toLowerCase().includes('curiosity')) continue

    const angleName = stripMarkdown(firstLine).replace(/^angle\s*\d+[:\s]*/i, '').trim()

    // Find sets within this angle block
    const setMatches = block.split(/\*\*Set\s+(\d+)[:\s]*\*\*/gi)
    if (setMatches.length < 2) {
      // Try alternate format: just numbered sets or bullet points
      const headlineMatches = [...block.matchAll(/[-*]\s*\*?\*?Headline\*?\*?[:\s]*(.+)/gi)]
      const subMatches = [...block.matchAll(/[-*]\s*\*?\*?Sub-?headline\*?\*?[:\s]*(.+)/gi)]
      const ctaMatches = [...block.matchAll(/[-*]\s*\*?\*?CTA\*?\*?[:\s]*(.+)/gi)]
      const visualMatches = [...block.matchAll(/[-*]\s*\*?\*?Visual\s*(?:Concept)?\*?\*?[:\s]*(.+)/gi)]

      for (let i = 0; i < headlineMatches.length; i++) {
        sets.push({
          angle: angleName || `Angle ${sets.length + 1}`,
          setNumber: i + 1,
          headline: stripMarkdown(headlineMatches[i]?.[1] || '').trim(),
          subHeadline: stripMarkdown(subMatches[i]?.[1] || '').trim(),
          cta: stripMarkdown(ctaMatches[i]?.[1] || '').trim(),
          visualConcept: stripMarkdown(visualMatches[i]?.[1] || '').trim(),
        })
      }
    } else {
      for (let i = 1; i < setMatches.length; i += 2) {
        const setNum = parseInt(setMatches[i]) || Math.ceil(i / 2)
        const setContent = setMatches[i + 1] || ''
        const hl = setContent.match(/[-*]\s*\*?\*?Headline\*?\*?[:\s]*(.+)/i)
        const sh = setContent.match(/[-*]\s*\*?\*?Sub-?headline\*?\*?[:\s]*(.+)/i)
        const ct = setContent.match(/[-*]\s*\*?\*?CTA\*?\*?[:\s]*(.+)/i)
        const vc = setContent.match(/[-*]\s*\*?\*?Visual\s*(?:Concept)?\*?\*?[:\s]*(.+)/i)
        sets.push({
          angle: angleName || `Angle ${Math.ceil(i / 2)}`,
          setNumber: setNum,
          headline: stripMarkdown(hl?.[1] || '').trim(),
          subHeadline: stripMarkdown(sh?.[1] || '').trim(),
          cta: stripMarkdown(ct?.[1] || '').trim(),
          visualConcept: stripMarkdown(vc?.[1] || '').trim(),
        })
      }
    }
  }

  return sets
}

function parsePrimaryTextBlocks(raw: string): { angle: string; label: string; text: string }[] {
  if (!raw) return []
  const blocks: { angle: string; label: string; text: string }[] = []
  const primaryMatch = raw.match(/PRIMARY TEXT[\s\S]*?(?=##\s*SECTION 4|##\s*RETARGETING|$)/i)
  if (!primaryMatch) return blocks

  const parts = primaryMatch[0].split(/###\s+/g).filter(Boolean)
  for (const part of parts) {
    const firstLine = part.split('\n')[0].trim()
    if (!firstLine.toLowerCase().includes('angle') && !firstLine.toLowerCase().includes('pain') && !firstLine.toLowerCase().includes('dream') && !firstLine.toLowerCase().includes('proof')) continue
    const angleName = stripMarkdown(firstLine)

    const subs = part.split(/####\s+/g)
    for (let i = 1; i < subs.length; i++) {
      const subFirstLine = subs[i].split('\n')[0].trim()
      const subContent = subs[i].split('\n').slice(1).join('\n').trim()
      if (subContent) {
        blocks.push({ angle: angleName, label: stripMarkdown(subFirstLine), text: stripMarkdown(subContent) })
      }
    }
  }
  return blocks
}

export function CopywriterUI({ clients }: { clients: Client[] }) {
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [days, setDays] = useState(30)
  const [mode, setMode] = useState<'variation' | 'refresh'>('variation')
  const [generating, setGenerating] = useState(false)
  const [output, setOutput] = useState('')
  const [currentBankId, setCurrentBankId] = useState<string | null>(null)
  const [history, setHistory] = useState<CopyBank[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate')
  const [viewMode, setViewMode] = useState<'full' | 'image-ads' | 'primary-text' | 'raw'>('full')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [imageAdSets, setImageAdSets] = useState<ImageAdSet[]>([])
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const outputRef = useRef<HTMLDivElement>(null)

  const selectedClientObj = clients.find(c => c.id === selectedClient)

  useEffect(() => {
    if (!selectedClient) { setHistory([]); return }
    setLoadingHistory(true)
    fetch(`/api/copywriter/history?clientId=${selectedClient}`)
      .then(r => r.json())
      .then(d => setHistory(d.banks || []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [selectedClient])

  useEffect(() => {
    if (generating && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output, generating])

  // Re-parse image ad sets when output changes and generation is done
  useEffect(() => {
    if (!generating && output) {
      setImageAdSets(parseImageAdSets(output))
    }
  }, [output, generating])

  const handleGenerate = useCallback(async () => {
    if (!selectedClient || generating) return
    setGenerating(true)
    setOutput('')
    setCurrentBankId(null)
    setActiveTab('generate')
    setImageAdSets([])

    try {
      const res = await fetch('/api/copywriter/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClient, days, mode }),
      })

      const reader = res.body?.getReader()
      if (!reader) return

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
            if (data.text) setOutput(prev => prev + data.text)
            if (data.done) {
              setCurrentBankId(data.id)
              fetch(`/api/copywriter/history?clientId=${selectedClient}`)
                .then(r => r.json())
                .then(d => setHistory(d.banks || []))
            }
            if (data.error) setOutput(prev => prev + `\n\nError: ${data.error}`)
          } catch {}
        }
      }
    } catch (err: any) {
      setOutput(prev => prev + `\n\nError: ${err.message}`)
    } finally {
      setGenerating(false)
    }
  }, [selectedClient, days, mode, generating])

  const loadBank = useCallback((bank: CopyBank) => {
    setOutput(bank.raw_output || '')
    setCurrentBankId(bank.id)
    setActiveTab('generate')
    setImageAdSets(parseImageAdSets(bank.raw_output || ''))
  }, [])

  const copyToClipboard = useCallback(async (text: string, id: string) => {
    await navigator.clipboard.writeText(stripMarkdown(text))
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  // Generate image for a specific ad set
  const generateImage = useCallback(async (index: number) => {
    const set = imageAdSets[index]
    if (!set || !selectedClient) return

    setImageAdSets(prev => prev.map((s, i) => i === index ? { ...s, generating: true, error: undefined } : s))

    try {
      // Build a prompt that combines the visual concept with the ad text
      const imagePrompt = `Create a professional Meta ad creative image.

HEADLINE TEXT ON THE IMAGE: "${set.headline}"
SUPPORTING TEXT: "${set.subHeadline}"
CTA BUTTON TEXT: "${set.cta}"

VISUAL CONCEPT: ${set.visualConcept || 'Professional, clean ad layout with the headline prominently displayed'}

The text must be crisp, legible, and properly typeset — large enough to read on a mobile phone. The headline should be the first thing the eye hits. The CTA should be in a contrasting pill-shaped button in the bottom 15%. Full-bleed composition, no white borders. Magazine-quality production.

NO LOGOS. NO placeholder text. NO gibberish. Every word spelled perfectly.`

      const res = await fetch('/api/creative-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient,
          mode: 'manual',
          manualPrompt: imagePrompt,
          aspectRatio,
          resolution: '2K',
          concept: `Copywriter: ${set.angle} - Set ${set.setNumber}`,
        }),
      })

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream')

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
            if (data.type === 'image') {
              setImageAdSets(prev => prev.map((s, i) => i === index ? { ...s, imageData: data.data, generating: false } : s))
            }
            if (data.type === 'error') {
              setImageAdSets(prev => prev.map((s, i) => i === index ? { ...s, error: data.message, generating: false } : s))
            }
            if (data.type === 'complete') {
              setImageAdSets(prev => prev.map((s, i) => {
                if (i !== index) return s
                return { ...s, generating: false, imageData: s.imageData || undefined }
              }))
            }
          } catch {}
        }
      }

      // If we got here without image data, mark as done
      setImageAdSets(prev => prev.map((s, i) => i === index ? { ...s, generating: false } : s))
    } catch (err: any) {
      setImageAdSets(prev => prev.map((s, i) => i === index ? { ...s, error: err.message, generating: false } : s))
    }
  }, [imageAdSets, selectedClient, aspectRatio])

  const sections = parseSections(output)
  const primaryBlocks = parsePrimaryTextBlocks(output)

  return (
    <div className="p-4 sm:p-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[20px] font-semibold text-[#111113] tracking-tight">Copywriter</h1>
          <p className="text-[12px] text-[#9d9da8] mt-0.5">Generate ad copy from winning ads, then create matching visuals</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setActiveTab('generate')} className={`px-3 py-1.5 text-[12px] font-medium rounded transition-colors ${activeTab === 'generate' ? 'bg-[#111113] text-white' : 'text-[#6b6b76] hover:bg-[#f4f4f6]'}`}>
            Generate
          </button>
          <button onClick={() => setActiveTab('history')} className={`px-3 py-1.5 text-[12px] font-medium rounded transition-colors ${activeTab === 'history' ? 'bg-[#111113] text-white' : 'text-[#6b6b76] hover:bg-[#f4f4f6]'}`}>
            History{history.length > 0 ? ` (${history.length})` : ''}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border border-[#e8e8ec] rounded-md p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-medium mb-1 block">Client</label>
            <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="w-full px-3 py-2 text-[13px] bg-[#f4f4f6] border border-[#e8e8ec] rounded focus:outline-none focus:border-[#2563eb] focus:bg-white">
              <option value="">Select client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-medium mb-1 block">Data Period</label>
            <select value={days} onChange={e => setDays(Number(e.target.value))} className="w-full px-3 py-2 text-[13px] bg-[#f4f4f6] border border-[#e8e8ec] rounded focus:outline-none focus:border-[#2563eb] focus:bg-white">
              {[7, 14, 30, 60, 90].map(d => <option key={d} value={d}>Last {d} days</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-medium mb-1 block">Mode</label>
            <div className="flex gap-1">
              <button onClick={() => setMode('variation')} className={`flex-1 px-3 py-2 text-[12px] font-medium rounded transition-colors ${mode === 'variation' ? 'bg-[#2563eb] text-white' : 'bg-[#f4f4f6] text-[#6b6b76] hover:bg-[#e8e8ec]'}`}>Variation</button>
              <button onClick={() => setMode('refresh')} className={`flex-1 px-3 py-2 text-[12px] font-medium rounded transition-colors ${mode === 'refresh' ? 'bg-[#f59e0b] text-white' : 'bg-[#f4f4f6] text-[#6b6b76] hover:bg-[#e8e8ec]'}`}>Refresh</button>
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-medium mb-1 block">Image Ratio</label>
            <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full px-3 py-2 text-[13px] bg-[#f4f4f6] border border-[#e8e8ec] rounded focus:outline-none focus:border-[#2563eb] focus:bg-white">
              <option value="1:1">1:1 (Square)</option>
              <option value="4:5">4:5 (Feed)</option>
              <option value="9:16">9:16 (Story/Reel)</option>
              <option value="16:9">16:9 (Landscape)</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={handleGenerate} disabled={!selectedClient || generating} className={`w-full px-4 py-2 text-[13px] font-semibold rounded transition-colors ${!selectedClient || generating ? 'bg-[#e8e8ec] text-[#9d9da8] cursor-not-allowed' : 'bg-[#111113] text-white hover:bg-[#2a2a2e]'}`}>
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".3" /><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
                  Generating...
                </span>
              ) : 'Generate Copy Bank'}
            </button>
          </div>
        </div>
        <div className="mt-3 px-1">
          {mode === 'variation' ? (
            <p className="text-[11px] text-[#6b6b76]">Variation mode iterates on winning ad patterns — same emotional angles, new words.</p>
          ) : (
            <p className="text-[11px] text-[#f59e0b]">Refresh mode finds new creative directions. Use when current copy is fatiguing.</p>
          )}
        </div>
      </div>

      {/* No client */}
      {!selectedClient && (
        <div className="bg-white border border-[#e8e8ec] rounded-md p-12 text-center">
          <div className="w-10 h-10 rounded bg-[#f4f4f6] flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-[#9d9da8]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 3.5l3 3L7 16H4v-3l9.5-9.5z" /><path d="M11 6l3 3" /></svg>
          </div>
          <p className="text-[13px] text-[#6b6b76]">Select a client to generate ad copy</p>
          <p className="text-[11px] text-[#9d9da8] mt-1">Analyzes top performing ads and creates a complete copy bank with image generation</p>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && selectedClient && (
        <div className="bg-white border border-[#e8e8ec] rounded-md">
          <div className="p-4 border-b border-[#e8e8ec]">
            <h2 className="text-[13px] font-semibold text-[#111113]">Copy Bank History</h2>
            <p className="text-[11px] text-[#9d9da8] mt-0.5">{selectedClientObj?.name}</p>
          </div>
          {loadingHistory ? (
            <div className="p-8 text-center text-[12px] text-[#9d9da8]">Loading...</div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-[12px] text-[#9d9da8]">No copy banks generated yet</div>
          ) : (
            <div className="divide-y divide-[#f4f4f6]">
              {history.map(bank => (
                <button key={bank.id} onClick={() => loadBank(bank)} className="w-full text-left px-4 py-3 hover:bg-[#f9f9fb] transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-medium text-[#111113]">{new Date(bank.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${bank.status === 'final' ? 'bg-[#dcfce7] text-[#16a34a]' : bank.status === 'archived' ? 'bg-[#f4f4f6] text-[#9d9da8]' : 'bg-[#fef3c7] text-[#f59e0b]'}`}>{bank.status}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[11px] text-[#9d9da8]">{bank.period_days}d data</span>
                        {bank.messaging_foundation?.primaryDesire && <span className="text-[11px] text-[#6b6b76] truncate max-w-[400px]">{bank.messaging_foundation.primaryDesire}</span>}
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-[#9d9da8]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 5l5 5-5 5" /></svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Generate Tab — Output */}
      {activeTab === 'generate' && selectedClient && output && (
        <>
          {/* View mode tabs */}
          <div className="flex items-center gap-1 mb-3">
            {(['full', 'image-ads', 'primary-text', 'raw'] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)} className={`px-3 py-1.5 text-[11px] font-medium rounded transition-colors ${viewMode === v ? 'bg-[#111113] text-white' : 'text-[#9d9da8] hover:bg-[#f4f4f6] hover:text-[#6b6b76]'}`}>
                {v === 'full' ? 'Full Output' : v === 'image-ads' ? 'Image Ad Sets' : v === 'primary-text' ? 'Primary Text' : 'Raw'}
              </button>
            ))}
            {generating && (
              <span className="flex items-center gap-1 text-[11px] text-[#2563eb] ml-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] animate-pulse" />
                Generating
              </span>
            )}
            {currentBankId && !generating && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#dcfce7] text-[#16a34a] font-medium ml-2">Saved</span>
            )}
          </div>

          {/* IMAGE AD SETS VIEW */}
          {viewMode === 'image-ads' && (
            <div className="space-y-4">
              {imageAdSets.length === 0 ? (
                <div className="bg-white border border-[#e8e8ec] rounded-md p-8 text-center text-[12px] text-[#9d9da8]">
                  {generating ? 'Generating image ad text...' : 'No image ad sets parsed. Try the Full Output view.'}
                </div>
              ) : (
                <>
                  {/* Group by angle */}
                  {(() => {
                    const angles = [...new Set(imageAdSets.map(s => s.angle))]
                    return angles.map(angle => (
                      <div key={angle}>
                        <h3 className="text-[13px] font-semibold text-[#111113] mb-2 uppercase tracking-wider">{angle}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {imageAdSets.filter(s => s.angle === angle).map((set, i) => {
                            const globalIndex = imageAdSets.indexOf(set)
                            return (
                              <div key={globalIndex} className="bg-white border border-[#e8e8ec] rounded-md overflow-hidden">
                                {/* Generated image */}
                                {set.imageData && (
                                  <div className="relative bg-[#f4f4f6]">
                                    <img src={`data:image/png;base64,${set.imageData}`} alt={set.headline} className="w-full object-contain" />
                                  </div>
                                )}

                                {/* Generating state */}
                                {set.generating && (
                                  <div className="h-48 bg-[#f4f4f6] flex items-center justify-center">
                                    <div className="text-center">
                                      <svg className="animate-spin w-6 h-6 text-[#2563eb] mx-auto mb-2" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".3" /><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
                                      <p className="text-[11px] text-[#9d9da8]">Generating image...</p>
                                    </div>
                                  </div>
                                )}

                                {/* Error state */}
                                {set.error && !set.generating && (
                                  <div className="h-24 bg-[#fef2f2] flex items-center justify-center px-4">
                                    <p className="text-[11px] text-[#dc2626]">{set.error}</p>
                                  </div>
                                )}

                                {/* Ad text content */}
                                <div className="p-3">
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f4f4f6] text-[#6b6b76] font-medium">Set {set.setNumber}</span>
                                    <button onClick={() => copyToClipboard(`${set.headline}\n${set.subHeadline}\n${set.cta}`, `ias-${globalIndex}`)} className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${copiedId === `ias-${globalIndex}` ? 'bg-[#dcfce7] text-[#16a34a]' : 'text-[#9d9da8] hover:bg-[#f4f4f6]'}`}>
                                      {copiedId === `ias-${globalIndex}` ? 'Copied' : 'Copy'}
                                    </button>
                                  </div>

                                  <p className="text-[14px] font-semibold text-[#111113] leading-tight">{set.headline}</p>
                                  <p className="text-[12px] text-[#6b6b76] mt-1">{set.subHeadline}</p>
                                  <div className="mt-2 inline-block px-2.5 py-1 bg-[#2563eb] text-white text-[11px] font-semibold rounded">{set.cta}</div>

                                  {set.visualConcept && (
                                    <div className="mt-3 pt-2 border-t border-[#f4f4f6]">
                                      <p className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-medium mb-0.5">Visual Concept</p>
                                      <p className="text-[11px] text-[#6b6b76] leading-relaxed">{set.visualConcept}</p>
                                    </div>
                                  )}

                                  {/* Generate Image button */}
                                  <button
                                    onClick={() => generateImage(globalIndex)}
                                    disabled={set.generating}
                                    className={`mt-3 w-full py-2 text-[12px] font-semibold rounded transition-colors ${
                                      set.generating
                                        ? 'bg-[#e8e8ec] text-[#9d9da8] cursor-not-allowed'
                                        : set.imageData
                                          ? 'bg-[#f4f4f6] text-[#6b6b76] hover:bg-[#e8e8ec]'
                                          : 'bg-[#111113] text-white hover:bg-[#2a2a2e]'
                                    }`}
                                  >
                                    {set.generating ? 'Generating...' : set.imageData ? 'Regenerate Image' : 'Generate Image'}
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  })()}
                </>
              )}
            </div>
          )}

          {/* PRIMARY TEXT VIEW */}
          {viewMode === 'primary-text' && (
            <div className="space-y-3">
              {primaryBlocks.length === 0 ? (
                <div className="bg-white border border-[#e8e8ec] rounded-md p-8 text-center text-[12px] text-[#9d9da8]">
                  {generating ? 'Generating primary text...' : 'No primary text blocks parsed. Try the Full Output view.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {primaryBlocks.map((block, i) => (
                    <div key={i} className="bg-white border border-[#e8e8ec] rounded-md overflow-hidden">
                      <div className="px-3 py-2 bg-[#f9f9fb] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-medium">{block.angle}</span>
                          <span className="text-[10px] text-[#6b6b76]">{block.label}</span>
                        </div>
                        <button onClick={() => copyToClipboard(block.text, `pt-${i}`)} className={`text-[10px] px-2 py-1 rounded transition-colors ${copiedId === `pt-${i}` ? 'bg-[#dcfce7] text-[#16a34a]' : 'text-[#9d9da8] hover:bg-white hover:text-[#111113]'}`}>
                          {copiedId === `pt-${i}` ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <div className="px-3 py-2.5">
                        <p className="text-[12px] text-[#3a3a44] whitespace-pre-wrap leading-relaxed">{block.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FULL OUTPUT VIEW */}
          {viewMode === 'full' && (
            <div className="bg-white border border-[#e8e8ec] rounded-md">
              <div ref={outputRef} className="max-h-[75vh] overflow-y-auto">
                {sections.length > 0 ? sections.map((section, i) => (
                  <div key={i} className="border-b border-[#f4f4f6] last:border-0">
                    <div className="px-4 py-3 bg-[#f9f9fb] flex items-center justify-between">
                      <h3 className="text-[12px] font-semibold text-[#111113] uppercase tracking-wider">{section.title}</h3>
                      <button onClick={() => copyToClipboard(section.content, `section-${i}`)} className="text-[10px] text-[#9d9da8] hover:text-[#111113] px-2 py-1 rounded hover:bg-white transition-colors">
                        {copiedId === `section-${i}` ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="px-4 py-3">
                      <pre className="text-[12px] text-[#3a3a44] whitespace-pre-wrap font-sans leading-relaxed">{stripMarkdown(section.content)}</pre>
                    </div>
                  </div>
                )) : (
                  <div className="p-4">
                    <pre className="text-[12px] text-[#3a3a44] whitespace-pre-wrap font-sans leading-relaxed">{stripMarkdown(output)}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RAW VIEW */}
          {viewMode === 'raw' && (
            <div className="bg-white border border-[#e8e8ec] rounded-md">
              <div ref={outputRef} className="max-h-[75vh] overflow-y-auto p-4">
                <div className="flex justify-end mb-2">
                  <button onClick={() => copyToClipboard(output, 'raw-all')} className={`text-[11px] px-3 py-1.5 rounded transition-colors ${copiedId === 'raw-all' ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#f4f4f6] text-[#6b6b76] hover:bg-[#e8e8ec]'}`}>
                    {copiedId === 'raw-all' ? 'Copied' : 'Copy All'}
                  </button>
                </div>
                <pre className="text-[12px] text-[#3a3a44] whitespace-pre-wrap font-sans leading-relaxed">{output}</pre>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {activeTab === 'generate' && selectedClient && !output && !generating && (
        <div className="bg-white border border-[#e8e8ec] rounded-md p-12 text-center">
          <div className="w-10 h-10 rounded bg-[#f4f4f6] flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-[#9d9da8]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h12v12H4z" /><path d="M7 8h6M7 11h4" /></svg>
          </div>
          <p className="text-[13px] text-[#6b6b76]">Ready to generate</p>
          <p className="text-[11px] text-[#9d9da8] mt-1">{mode === 'variation' ? 'Will iterate on winning ad copy patterns' : 'Will explore new creative directions'}</p>
        </div>
      )}
    </div>
  )
}
