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
    // Match ## or ### section headers
    const h = line.match(/^#{2,3}\s+(?:SECTION \d+:\s*)?(.+)/i)
    if (h) {
      if (currentTitle) sections.push({ title: stripMarkdown(currentTitle), content: currentContent.join('\n') })
      currentTitle = h[1]
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

  // Find the IMAGE AD TEXT section — flexible header matching
  const iatMatch = raw.match(/#{2,4}\s*(?:SECTION 2[:\s]*)?IMAGE AD TEXT[\s\S]*?(?=#{2,3}\s*(?:SECTION [34]|PRIMARY TEXT|RETARGETING)|$)/i)
  if (!iatMatch) return sets

  const section = iatMatch[0]

  // Split by angle headers — match **ANGLE N: Name** or ### Angle N: Name
  const anglePattern = /(?:#{2,4}\s*|\*\*\s*)(?:ANGLE\s*\d+[:\s—–-]*)([\s\S]*?)(?:\*\*)?$/gim
  const anglePositions: { name: string; start: number }[] = []
  let m
  while ((m = anglePattern.exec(section)) !== null) {
    anglePositions.push({ name: stripMarkdown(m[1]).trim(), start: m.index })
  }

  if (anglePositions.length === 0) {
    // Fallback: just find all headline/sub/cta/visual groups in the whole section
    parseSetFields(section, 'Ad Copy', sets)
    return sets
  }

  for (let a = 0; a < anglePositions.length; a++) {
    const start = anglePositions[a].start
    const end = a + 1 < anglePositions.length ? anglePositions[a + 1].start : section.length
    const block = section.slice(start, end)
    parseSetFields(block, anglePositions[a].name, sets)
  }

  return sets
}

function parseSetFields(block: string, angleName: string, sets: ImageAdSet[]) {
  // Universal approach: scan line by line, detect Headline fields, group into sets
  const lines = block.split('\n')
  let currentSet: { headline: string; sub: string; cta: string; visual: string } | null = null
  let setNum = 0

  for (const line of lines) {
    // Match headline with flexible formatting: "* Headline: ...", "    *   Headline: ...", "- **Headline:** ..."
    const hlMatch = line.match(/^\s*[*-]\s*\*?\*?\s*Headline\s*\*?\*?\s*[:]\s*(.+)/i)
    if (hlMatch) {
      // Push previous set if exists
      if (currentSet && currentSet.headline) {
        setNum++
        sets.push({
          angle: angleName,
          setNumber: setNum,
          headline: stripMarkdown(currentSet.headline).trim(),
          subHeadline: stripMarkdown(currentSet.sub).trim(),
          cta: stripMarkdown(currentSet.cta).trim(),
          visualConcept: stripMarkdown(currentSet.visual).trim(),
        })
      }
      currentSet = { headline: hlMatch[1], sub: '', cta: '', visual: '' }
      continue
    }
    if (!currentSet) continue

    const subMatch = line.match(/^\s*[*-]\s*\*?\*?\s*Sub-?\s*headline\s*\*?\*?\s*[:]\s*(.+)/i)
    if (subMatch) { currentSet.sub = subMatch[1]; continue }

    const ctaMatch = line.match(/^\s*[*-]\s*\*?\*?\s*CTA\s*\*?\*?\s*[:]\s*(.+)/i)
    if (ctaMatch) { currentSet.cta = ctaMatch[1]; continue }

    const visMatch = line.match(/^\s*[*-]\s*\*?\*?\s*(?:Visual\s*(?:Concept)?|Image\s*Prompt)\s*\*?\*?\s*[:]\s*(.+)/i)
    if (visMatch) { currentSet.visual = visMatch[1]; continue }
  }
  // Push last set
  if (currentSet && currentSet.headline) {
    setNum++
    sets.push({
      angle: angleName,
      setNumber: setNum,
      headline: stripMarkdown(currentSet.headline).trim(),
      subHeadline: stripMarkdown(currentSet.sub).trim(),
      cta: stripMarkdown(currentSet.cta).trim(),
      visualConcept: stripMarkdown(currentSet.visual).trim(),
    })
  }
}

// removed extractAndPush - now using parseSetFields only

function parsePrimaryTextBlocks(raw: string): { angle: string; label: string; text: string }[] {
  if (!raw) return []
  const blocks: { angle: string; label: string; text: string }[] = []

  // Match section 3 / PRIMARY TEXT with flexible headers
  const primaryMatch = raw.match(/#{2,4}\s*(?:SECTION 3[:\s]*)?PRIMARY TEXT[\s\S]*?(?=#{2,3}\s*(?:SECTION 4|RETARGETING)|$)/i)
  if (!primaryMatch) return blocks

  const section = primaryMatch[0]

  // Split by angle headers (### or ** Angle N: ... **)
  const angleParts = section.split(/(?:#{2,4}|\*\*)\s*(?:ANGLE\s*\d+[:\s—–-]*)/i).filter(Boolean)

  if (angleParts.length <= 1) {
    // Fallback: split by #### sub-headers (Short/Medium/Long/Headlines/Strategy)
    const subs = section.split(/#{3,4}\s+/g)
    for (let i = 1; i < subs.length; i++) {
      const firstLine = subs[i].split('\n')[0].trim()
      const content = subs[i].split('\n').slice(1).join('\n').trim()
      if (content && !firstLine.toLowerCase().includes('primary text')) {
        blocks.push({ angle: 'Copy', label: stripMarkdown(firstLine), text: stripMarkdown(content) })
      }
    }
    return blocks
  }

  for (const part of angleParts) {
    const lines = part.split('\n')
    const firstLine = lines[0].trim().replace(/\*\*$/g, '')
    const angleName = stripMarkdown(firstLine).trim()
    if (!angleName || angleName.toLowerCase() === 'primary text') continue

    // Split by sub-headers (#### Short Version, etc.) or **Short Version** bold markers
    const subPattern = /(?:#{3,4}\s+|\*\*\s*)((?:Short|Medium|Long|Headlines?|Strategy)[^*\n]*?)(?:\*\*)?$/gim
    const subPositions: { label: string; start: number }[] = []
    let sm
    while ((sm = subPattern.exec(part)) !== null) {
      subPositions.push({ label: stripMarkdown(sm[1]).trim(), start: sm.index + sm[0].length })
    }

    for (let s = 0; s < subPositions.length; s++) {
      const start = subPositions[s].start
      const end = s + 1 < subPositions.length ? subPositions[s + 1].start - (subPositions[s + 1].label.length + 10) : part.length
      const content = part.slice(start, end).trim()
      if (content) {
        blocks.push({ angle: angleName, label: subPositions[s].label, text: stripMarkdown(content) })
      }
    }

    // If no sub-headers found, push the whole angle as one block
    if (subPositions.length === 0) {
      const content = lines.slice(1).join('\n').trim()
      if (content) blocks.push({ angle: angleName, label: 'Full Copy', text: stripMarkdown(content) })
    }
  }
  return blocks
}

export function CopywriterUI({ clients, initialClientId }: { clients: Client[]; initialClientId?: string }) {
  const [selectedClient, setSelectedClient] = useState<string>(initialClientId || '')
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
  const [previewImage, setPreviewImage] = useState<string | null>(null)
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

IMAGE DIRECTION: ${set.visualConcept || 'Professional, clean ad layout with the headline prominently displayed. Leave space for text overlay.'}

CRITICAL REQUIREMENTS:
- The headline text must be crisp, legible, and properly typeset in a bold clean sans-serif — large enough to read on a mobile phone at arm's length. It should be the first thing the eye hits.
- The CTA should be in a contrasting pill-shaped button in the bottom 15%.
- Full-bleed composition, no white borders, no frames. Magazine-quality production.
- Follow the image direction above EXACTLY — it describes the scene, lighting, camera angle, and composition.
- NO logos. NO placeholder text. NO gibberish. Every word spelled perfectly.`

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
          source: 'copywriter',
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
            if (data.type === 'error') {
              setImageAdSets(prev => prev.map((s, i) => i === index ? { ...s, error: data.message, generating: false } : s))
            }
            if (data.type === 'complete' && data.imageData) {
              setImageAdSets(prev => prev.map((s, i) => i === index ? { ...s, imageData: data.imageData, generating: false } : s))
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
        <div className="mt-3 px-1 flex items-center justify-between">
          <div>
            {mode === 'variation' ? (
              <p className="text-[11px] text-[#6b6b76]">Variation mode iterates on winning ad patterns — same emotional angles, new words.</p>
            ) : (
              <p className="text-[11px] text-[#f59e0b]">Refresh mode finds new creative directions. Use when current copy is fatiguing.</p>
            )}
          </div>
          {selectedClient && (
            <div className="flex items-center gap-2 ml-4 shrink-0">
              <a href={`/creative-studio?client=${selectedClient}`} className="text-[10px] text-[#9d9da8] hover:text-[#2563eb] transition-colors">Image Studio</a>
              <span className="text-[#e8e8ec]">|</span>
              <a href={`/ad-library?client=${selectedClient}`} className="text-[10px] text-[#9d9da8] hover:text-[#2563eb] transition-colors">Ad Library</a>
              <span className="text-[#e8e8ec]">|</span>
              <a href={`/pegasus?client=${selectedClient}`} className="text-[10px] text-[#9d9da8] hover:text-[#2563eb] transition-colors">Ask Pegasus</a>
            </div>
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
                  {/* Action bar */}
                  <div className="flex items-center justify-between bg-white border border-[#e8e8ec] rounded-md px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] text-[#6b6b76]">
                        {imageAdSets.filter(s => s.imageData).length}/{imageAdSets.length} images generated
                      </span>
                      <div className="h-1.5 w-32 bg-[#f4f4f6] rounded-full overflow-hidden">
                        <div className="h-full bg-[#16a34a] rounded-full transition-all" style={{ width: `${(imageAdSets.filter(s => s.imageData).length / imageAdSets.length) * 100}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}
                        className="px-2 py-1 rounded border border-[#e8e8ec] text-[11px] text-[#111113] bg-white">
                        <option value="1:1">1:1 Feed</option>
                        <option value="4:5">4:5 Portrait</option>
                        <option value="9:16">9:16 Stories</option>
                        <option value="16:9">16:9 Landscape</option>
                      </select>
                      <button
                        onClick={async () => {
                          const ungenerated = imageAdSets.map((s, i) => ({ s, i })).filter(({ s }) => !s.imageData && !s.generating)
                          for (const { i } of ungenerated) {
                            await generateImage(i)
                          }
                        }}
                        disabled={imageAdSets.some(s => s.generating) || imageAdSets.every(s => s.imageData)}
                        className="px-3 py-1.5 rounded bg-[#111113] text-white text-[11px] font-medium hover:bg-[#2a2a2e] disabled:opacity-40 transition-colors"
                      >
                        {imageAdSets.some(s => s.generating) ? 'Generating...' : imageAdSets.every(s => s.imageData) ? 'All Generated' : `Generate All (${imageAdSets.filter(s => !s.imageData).length})`}
                      </button>
                    </div>
                  </div>

                  {/* Group by angle */}
                  {(() => {
                    const angles = [...new Set(imageAdSets.map(s => s.angle))]
                    return angles.map(angle => {
                      const angleSets = imageAdSets.filter(s => s.angle === angle)
                      const generatedCount = angleSets.filter(s => s.imageData).length
                      return (
                      <div key={angle}>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-[13px] font-semibold text-[#111113] uppercase tracking-wider">{angle}</h3>
                          <span className="text-[10px] text-[#9d9da8]">{generatedCount}/{angleSets.length} images</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {angleSets.map((set, i) => {
                            const globalIndex = imageAdSets.indexOf(set)
                            return (
                              <div key={globalIndex} className="bg-white border border-[#e8e8ec] rounded-md overflow-hidden group">
                                {/* Image area — fixed height */}
                                <div className="relative aspect-square bg-[#f4f4f6]">
                                  {set.imageData && (
                                    <>
                                      <img src={set.imageData} alt={set.headline} className="w-full h-full object-cover cursor-pointer" onClick={() => setPreviewImage(set.imageData!)} />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5">
                                        <button onClick={() => { const a = document.createElement('a'); a.href = set.imageData!; a.download = `${set.angle}-set${set.setNumber}.png`; a.click() }}
                                          className="bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-medium text-[#111113] hover:bg-white shadow-sm">
                                          Download
                                        </button>
                                        <button onClick={() => setPreviewImage(set.imageData!)}
                                          className="bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-medium text-[#111113] hover:bg-white shadow-sm">
                                          Expand
                                        </button>
                                      </div>
                                    </>
                                  )}

                                  {set.generating && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <div className="text-center">
                                        <svg className="animate-spin w-8 h-8 text-[#2563eb] mx-auto mb-2" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity=".2" /><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                                        <p className="text-[11px] text-[#6b6b76] font-medium">Generating...</p>
                                        <p className="text-[10px] text-[#9d9da8] mt-0.5">15-30 seconds</p>
                                      </div>
                                    </div>
                                  )}

                                  {set.error && !set.generating && (
                                    <div className="absolute inset-0 flex items-center justify-center px-4">
                                      <div className="text-center">
                                        <p className="text-[11px] text-[#dc2626] font-medium">Generation failed</p>
                                        <p className="text-[10px] text-[#9d9da8] mt-1">{set.error}</p>
                                        <button onClick={() => generateImage(globalIndex)} className="mt-2 text-[10px] text-[#2563eb] hover:underline">Retry</button>
                                      </div>
                                    </div>
                                  )}

                                  {!set.imageData && !set.generating && !set.error && (
                                    <div className="absolute inset-0 flex items-center justify-center cursor-pointer hover:bg-[#e8e8ec] transition-colors" onClick={() => generateImage(globalIndex)}>
                                      <div className="text-center">
                                        <svg className="w-8 h-8 text-[#9d9da8] mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        <p className="text-[11px] text-[#9d9da8] font-medium">Click to generate</p>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Ad text content */}
                                <div className="p-3">
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f4f4f6] text-[#6b6b76] font-medium">Set {set.setNumber}</span>
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => copyToClipboard(`${set.headline}\n${set.subHeadline}\n${set.cta}`, `ias-${globalIndex}`)} className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${copiedId === `ias-${globalIndex}` ? 'bg-[#dcfce7] text-[#16a34a]' : 'text-[#9d9da8] hover:bg-[#f4f4f6]'}`}>
                                        {copiedId === `ias-${globalIndex}` ? 'Copied' : 'Copy text'}
                                      </button>
                                    </div>
                                  </div>

                                  <p className="text-[14px] font-semibold text-[#111113] leading-tight">{set.headline}</p>
                                  <p className="text-[12px] text-[#6b6b76] mt-1">{set.subHeadline}</p>
                                  <div className="mt-2 inline-block px-2.5 py-1 bg-[#2563eb] text-white text-[11px] font-semibold rounded">{set.cta}</div>

                                  {set.visualConcept && (
                                    <details className="mt-3 pt-2 border-t border-[#f4f4f6]">
                                      <summary className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-medium cursor-pointer hover:text-[#6b6b76]">Image Prompt</summary>
                                      <p className="text-[11px] text-[#6b6b76] leading-relaxed mt-1">{set.visualConcept}</p>
                                    </details>
                                  )}

                                  {/* Generate/Regenerate button */}
                                  {set.imageData ? (
                                    <button
                                      onClick={() => generateImage(globalIndex)}
                                      disabled={set.generating}
                                      className="mt-2 w-full py-1.5 text-[11px] font-medium rounded border border-[#e8e8ec] text-[#6b6b76] hover:bg-[#f4f4f6] disabled:opacity-40 transition-colors"
                                    >
                                      Regenerate
                                    </button>
                                  ) : !set.generating && (
                                    <button
                                      onClick={() => generateImage(globalIndex)}
                                      className="mt-2 w-full py-1.5 text-[11px] font-medium rounded bg-[#111113] text-white hover:bg-[#2a2a2e] transition-colors"
                                    >
                                      Generate Image
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )})
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
      {/* Image preview modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] object-contain rounded-md" />
            <div className="absolute top-3 right-3 flex gap-2">
              <a href={previewImage} download="copywriter-creative.png"
                className="bg-white/90 backdrop-blur px-3 py-1.5 rounded text-[11px] font-medium text-[#111113] hover:bg-white shadow-sm">
                Download
              </a>
              <button onClick={() => setPreviewImage(null)}
                className="bg-white/90 backdrop-blur w-8 h-8 flex items-center justify-center rounded text-[#111113] hover:bg-white shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
