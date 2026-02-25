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

// Parse structured sections from raw output for the card view
function parseSections(raw: string): { title: string; content: string }[] {
  if (!raw) return []
  const lines = raw.split('\n')
  const sections: { title: string; content: string }[] = []
  let currentTitle = ''
  let currentContent: string[] = []

  for (const line of lines) {
    const h2 = line.match(/^##\s+(?:SECTION \d+:\s*)?(.+)/i)
    const h3 = line.match(/^###\s+(.+)/i)
    if (h2) {
      if (currentTitle) sections.push({ title: stripMarkdown(currentTitle), content: currentContent.join('\n') })
      currentTitle = h2[1]
      currentContent = []
    } else if (h3 && currentTitle) {
      // Sub-section — include as part of content with a visual break
      currentContent.push(`\n--- ${stripMarkdown(h3[1])} ---\n`)
    } else {
      currentContent.push(line)
    }
  }
  if (currentTitle) sections.push({ title: stripMarkdown(currentTitle), content: currentContent.join('\n') })
  return sections
}

// Parse ad copy blocks from raw text for the copy cards view
function parseCopyBlocks(raw: string): { angle: string; type: string; label: string; text: string }[] {
  if (!raw) return []
  const blocks: { angle: string; type: string; label: string; text: string }[] = []

  // Find primary text sections
  const angleRegex = /###\s*(?:ANGLE\s*\d+[:\s]*)?(.+?)(?:\n)/gi
  const shortRegex = /####?\s*Short\s*(?:Version)?[^]*?(?=####?\s*Medium|####?\s*Long|###\s|$)/gi
  const mediumRegex = /####?\s*Medium\s*(?:Version)?[^]*?(?=####?\s*Long|###\s|$)/gi
  const longRegex = /####?\s*Long\s*(?:Version)?[^]*?(?=###\s|##\s|$)/gi

  // Simplified: just return blocks by section for copy-paste
  const primaryMatch = raw.match(/PRIMARY TEXT[\s\S]*?(?=##\s*SECTION 4|##\s*RETARGETING|$)/i)
  if (primaryMatch) {
    const parts = primaryMatch[0].split(/###\s+/g).filter(Boolean)
    for (const part of parts) {
      const firstLine = part.split('\n')[0].trim()
      if (firstLine.toLowerCase().includes('angle') || firstLine.toLowerCase().includes('primary')) {
        // Split by #### for sub-sections
        const subs = part.split(/####\s+/g)
        for (let i = 1; i < subs.length; i++) {
          const subFirstLine = subs[i].split('\n')[0].trim()
          const subContent = subs[i].split('\n').slice(1).join('\n').trim()
          if (subContent) {
            blocks.push({
              angle: stripMarkdown(firstLine),
              type: subFirstLine.toLowerCase().includes('short') ? 'short' : subFirstLine.toLowerCase().includes('medium') ? 'medium' : subFirstLine.toLowerCase().includes('long') ? 'long' : subFirstLine.toLowerCase().includes('headline') ? 'headlines' : 'other',
              label: stripMarkdown(subFirstLine),
              text: stripMarkdown(subContent),
            })
          }
        }
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
  const [viewMode, setViewMode] = useState<'raw' | 'sections' | 'copy-cards'>('sections')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)

  const selectedClientObj = clients.find(c => c.id === selectedClient)

  // Load history when client changes
  useEffect(() => {
    if (!selectedClient) { setHistory([]); return }
    setLoadingHistory(true)
    fetch(`/api/copywriter/history?clientId=${selectedClient}`)
      .then(r => r.json())
      .then(d => setHistory(d.banks || []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [selectedClient])

  // Auto-scroll during generation
  useEffect(() => {
    if (generating && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output, generating])

  const handleGenerate = useCallback(async () => {
    if (!selectedClient || generating) return
    setGenerating(true)
    setOutput('')
    setCurrentBankId(null)
    setActiveTab('generate')

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
              // Refresh history
              fetch(`/api/copywriter/history?clientId=${selectedClient}`)
                .then(r => r.json())
                .then(d => setHistory(d.banks || []))
            }
            if (data.error) {
              setOutput(prev => prev + `\n\nError: ${data.error}`)
            }
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
  }, [])

  const copyToClipboard = useCallback(async (text: string, id: string) => {
    await navigator.clipboard.writeText(stripMarkdown(text))
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  const copyHtml = useCallback(async (text: string, id: string) => {
    // Convert to simple HTML for Gmail paste
    const html = stripMarkdown(text)
      .split('\n\n')
      .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('')
    const blob = new Blob([html], { type: 'text/html' })
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob, 'text/plain': new Blob([stripMarkdown(text)], { type: 'text/plain' }) })])
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  const sections = parseSections(output)
  const copyBlocks = parseCopyBlocks(output)

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[20px] font-semibold text-[#111113] tracking-tight">Copywriter</h1>
          <p className="text-[12px] text-[#9d9da8] mt-0.5">AI-powered ad copy generation based on your winning ads</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('generate')}
            className={`px-3 py-1.5 text-[12px] font-medium rounded transition-colors ${
              activeTab === 'generate' ? 'bg-[#111113] text-white' : 'text-[#6b6b76] hover:bg-[#f4f4f6]'
            }`}
          >
            Generate
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 text-[12px] font-medium rounded transition-colors ${
              activeTab === 'history' ? 'bg-[#111113] text-white' : 'text-[#6b6b76] hover:bg-[#f4f4f6]'
            }`}
          >
            History{history.length > 0 ? ` (${history.length})` : ''}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border border-[#e8e8ec] rounded-md p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Client selector */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-medium mb-1 block">Client</label>
            <select
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
              className="w-full px-3 py-2 text-[13px] bg-[#f4f4f6] border border-[#e8e8ec] rounded focus:outline-none focus:border-[#2563eb] focus:bg-white"
            >
              <option value="">Select client...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-medium mb-1 block">Data Period</label>
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="w-full px-3 py-2 text-[13px] bg-[#f4f4f6] border border-[#e8e8ec] rounded focus:outline-none focus:border-[#2563eb] focus:bg-white"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>

          {/* Mode */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-medium mb-1 block">Mode</label>
            <div className="flex gap-1">
              <button
                onClick={() => setMode('variation')}
                className={`flex-1 px-3 py-2 text-[12px] font-medium rounded transition-colors ${
                  mode === 'variation'
                    ? 'bg-[#2563eb] text-white'
                    : 'bg-[#f4f4f6] text-[#6b6b76] hover:bg-[#e8e8ec]'
                }`}
              >
                Variation
              </button>
              <button
                onClick={() => setMode('refresh')}
                className={`flex-1 px-3 py-2 text-[12px] font-medium rounded transition-colors ${
                  mode === 'refresh'
                    ? 'bg-[#f59e0b] text-white'
                    : 'bg-[#f4f4f6] text-[#6b6b76] hover:bg-[#e8e8ec]'
                }`}
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Generate */}
          <div className="flex items-end">
            <button
              onClick={handleGenerate}
              disabled={!selectedClient || generating}
              className={`w-full px-4 py-2 text-[13px] font-semibold rounded transition-colors ${
                !selectedClient || generating
                  ? 'bg-[#e8e8ec] text-[#9d9da8] cursor-not-allowed'
                  : 'bg-[#111113] text-white hover:bg-[#2a2a2e]'
              }`}
            >
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".3" /><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
                  Generating...
                </span>
              ) : 'Generate Copy Bank'}
            </button>
          </div>
        </div>

        {/* Mode description */}
        <div className="mt-3 px-1">
          {mode === 'variation' ? (
            <p className="text-[11px] text-[#6b6b76]">Variation mode analyzes your winning ads and creates new copy that stays close to proven patterns. Same emotional angles, new words.</p>
          ) : (
            <p className="text-[11px] text-[#f59e0b]">Refresh mode studies your audience through winners but deliberately takes new creative directions. Use when current copy is fatiguing.</p>
          )}
        </div>
      </div>

      {/* No client selected */}
      {!selectedClient && (
        <div className="bg-white border border-[#e8e8ec] rounded-md p-12 text-center">
          <div className="w-10 h-10 rounded bg-[#f4f4f6] flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-[#9d9da8]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15.5 3.5l1 1-6.5 6.5-2 .5.5-2 6.5-6.5z" />
              <path d="M8 4H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-3" />
            </svg>
          </div>
          <p className="text-[13px] text-[#6b6b76]">Select a client to generate ad copy</p>
          <p className="text-[11px] text-[#9d9da8] mt-1">The AI will analyze their top performing ads and create a complete copy bank</p>
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
                <button
                  key={bank.id}
                  onClick={() => loadBank(bank)}
                  className="w-full text-left px-4 py-3 hover:bg-[#f9f9fb] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-medium text-[#111113]">
                          {new Date(bank.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          bank.status === 'final' ? 'bg-[#dcfce7] text-[#16a34a]' :
                          bank.status === 'archived' ? 'bg-[#f4f4f6] text-[#9d9da8]' :
                          'bg-[#fef3c7] text-[#f59e0b]'
                        }`}>
                          {bank.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[11px] text-[#9d9da8]">{bank.period_days}d data</span>
                        {bank.messaging_foundation?.primaryDesire && (
                          <span className="text-[11px] text-[#6b6b76] truncate max-w-[400px]">
                            {bank.messaging_foundation.primaryDesire}
                          </span>
                        )}
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
        <div className="bg-white border border-[#e8e8ec] rounded-md">
          {/* Output header */}
          <div className="p-4 border-b border-[#e8e8ec] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold text-[#111113]">
                Copy Bank — {selectedClientObj?.name}
              </h2>
              {generating && (
                <span className="flex items-center gap-1 text-[11px] text-[#2563eb]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] animate-pulse" />
                  Generating
                </span>
              )}
              {currentBankId && !generating && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#dcfce7] text-[#16a34a] font-medium">Saved</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {(['sections', 'copy-cards', 'raw'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                    viewMode === v ? 'bg-[#111113] text-white' : 'text-[#9d9da8] hover:bg-[#f4f4f6]'
                  }`}
                >
                  {v === 'sections' ? 'Sections' : v === 'copy-cards' ? 'Copy Cards' : 'Raw'}
                </button>
              ))}
            </div>
          </div>

          {/* Sections view */}
          {viewMode === 'sections' && (
            <div ref={outputRef} className="max-h-[75vh] overflow-y-auto">
              {sections.length > 0 ? sections.map((section, i) => (
                <div key={i} className="border-b border-[#f4f4f6] last:border-0">
                  <div className="px-4 py-3 bg-[#f9f9fb] flex items-center justify-between">
                    <h3 className="text-[12px] font-semibold text-[#111113] uppercase tracking-wider">{section.title}</h3>
                    <button
                      onClick={() => copyToClipboard(section.content, `section-${i}`)}
                      className="text-[10px] text-[#9d9da8] hover:text-[#111113] px-2 py-1 rounded hover:bg-white transition-colors"
                    >
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
          )}

          {/* Copy Cards view */}
          {viewMode === 'copy-cards' && (
            <div ref={outputRef} className="max-h-[75vh] overflow-y-auto p-4">
              {copyBlocks.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {copyBlocks.map((block, i) => (
                    <div key={i} className="border border-[#e8e8ec] rounded-md overflow-hidden">
                      <div className="px-3 py-2 bg-[#f9f9fb] flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-[#9d9da8] font-medium">{block.angle}</span>
                          <span className="text-[10px] text-[#6b6b76] ml-2">{block.label}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => copyToClipboard(block.text, `block-${i}`)}
                            className={`text-[10px] px-2 py-1 rounded transition-colors ${
                              copiedId === `block-${i}` ? 'bg-[#dcfce7] text-[#16a34a]' : 'text-[#9d9da8] hover:bg-white hover:text-[#111113]'
                            }`}
                          >
                            {copiedId === `block-${i}` ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                      <div className="px-3 py-2.5">
                        <p className="text-[12px] text-[#3a3a44] whitespace-pre-wrap leading-relaxed">{block.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-[12px] text-[#9d9da8] py-8">
                  {generating ? 'Generating copy blocks...' : 'No copy blocks parsed — switch to Sections or Raw view'}
                </div>
              )}

              {/* Also show Messaging Foundation as a card */}
              {sections.length > 0 && sections[0]?.title?.toLowerCase().includes('messaging') && (
                <div className="mt-4 border border-[#e8e8ec] rounded-md overflow-hidden">
                  <div className="px-3 py-2 bg-[#f9f9fb]">
                    <span className="text-[10px] uppercase tracking-wider text-[#2563eb] font-semibold">Messaging Foundation</span>
                  </div>
                  <div className="px-3 py-2.5">
                    <pre className="text-[12px] text-[#3a3a44] whitespace-pre-wrap font-sans leading-relaxed">{stripMarkdown(sections[0].content)}</pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Raw view */}
          {viewMode === 'raw' && (
            <div ref={outputRef} className="max-h-[75vh] overflow-y-auto p-4">
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => copyToClipboard(output, 'raw-all')}
                  className={`text-[11px] px-3 py-1.5 rounded transition-colors ${
                    copiedId === 'raw-all' ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#f4f4f6] text-[#6b6b76] hover:bg-[#e8e8ec]'
                  }`}
                >
                  {copiedId === 'raw-all' ? 'Copied' : 'Copy All'}
                </button>
              </div>
              <pre className="text-[12px] text-[#3a3a44] whitespace-pre-wrap font-sans leading-relaxed">{output}</pre>
            </div>
          )}
        </div>
      )}

      {/* Empty state during generation before any output */}
      {activeTab === 'generate' && selectedClient && !output && !generating && (
        <div className="bg-white border border-[#e8e8ec] rounded-md p-12 text-center">
          <div className="w-10 h-10 rounded bg-[#f4f4f6] flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-[#9d9da8]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h12v12H4z" /><path d="M7 8h6M7 11h4" />
            </svg>
          </div>
          <p className="text-[13px] text-[#6b6b76]">Ready to generate</p>
          <p className="text-[11px] text-[#9d9da8] mt-1">
            {mode === 'variation' ? 'Will iterate on winning ad copy patterns' : 'Will explore new creative directions based on audience insights'}
          </p>
        </div>
      )}
    </div>
  )
}
