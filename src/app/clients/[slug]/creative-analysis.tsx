'use client'

import { useState, useRef, useEffect } from 'react'

interface AdCreative {
  name: string
  imageUrl: string | null
  videoUrl: string | null
  thumbnailUrl: string | null
  isVideo: boolean
  spend: number
  results: number
  cpr: number
  ctr: number
  headline: string | null
  age: number | null
  isTop: boolean
}

const PERIOD_OPTIONS = [
  { label: '7d', value: 7 },
  { label: '14d', value: 14 },
  { label: '30d', value: 30 },
  { label: '60d', value: 60 },
  { label: '90d', value: 90 },
]

export function CreativeAnalysis({ clientId }: { clientId: string }) {
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState('')
  const [ads, setAds] = useState<AdCreative[]>([])
  const [days, setDays] = useState(30)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const analysisRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (analysisRef.current) {
      analysisRef.current.scrollTop = analysisRef.current.scrollHeight
    }
  }, [analysis])

  async function runAnalysis() {
    setAnalyzing(true)
    setAnalysis('')
    setAds([])
    setError(null)
    setStatusMessage('Starting analysis...')

    try {
      const res = await fetch('/api/creatives/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, days }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Analysis failed')
        setAnalyzing(false)
        return
      }

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
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'ads') setAds(data.ads)
              else if (data.type === 'status') setStatusMessage(data.message)
              else if (data.type === 'text') { setStatusMessage(null); setAnalysis(prev => prev + data.text) }
              else if (data.type === 'error') setError(data.message)
              else if (data.type === 'done') break
            } catch {}
          }
        }
      }
    } catch (e: any) {
      setError(e.message || 'Analysis failed')
    }
    setAnalyzing(false)
  }

  function formatAnalysis(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^### (.+)$/gm, '<h4 class="text-[13px] font-semibold text-[#111113] mt-4 mb-2">$1</h4>')
      .replace(/^## (.+)$/gm, '<h3 class="text-[14px] font-semibold text-[#111113] mt-5 mb-2">$1</h3>')
      .replace(/^# (.+)$/gm, '<h3 class="text-[14px] font-semibold text-[#111113] mt-5 mb-2">$1</h3>')
      .replace(/^([A-Z][A-Z\s']+)$/gm, '<h3 class="text-[13px] font-semibold text-[#111113] mt-5 mb-2 uppercase tracking-wide">$1</h3>')
      .replace(/^- (.+)$/gm, '<li class="ml-4 mb-1">$1</li>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-[#111113]">Creative Analysis</h2>
          <p className="text-[12px] text-[#9d9da8] mt-0.5">AI-powered visual analysis of your top and bottom performing ad creatives</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-[#e8e8ec] rounded overflow-hidden">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`px-2.5 py-1 text-[11px] font-medium border-r border-[#e8e8ec] last:border-r-0 transition-colors ${
                  days === opt.value
                    ? 'bg-[#111113] text-white'
                    : 'bg-white text-[#9d9da8] hover:text-[#111113]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="px-4 py-1.5 rounded bg-[#2563eb] text-white text-[12px] font-medium hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            {analyzing ? 'Analyzing...' : 'Analyze Creatives'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[#fef2f2] border border-[#fecaca] rounded p-3 text-[12px] text-[#dc2626]">
          {error}
        </div>
      )}

      {/* Creatives grid */}
      {ads.length > 0 && (
        <div>
          <div className="mb-3">
            <h3 className="text-[13px] font-semibold text-[#111113]">Creatives Analyzed</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {ads.map((ad, i) => (
              <div key={i} className="border border-[#e8e8ec] rounded overflow-hidden bg-white">
                <div className="relative aspect-square bg-[#f8f8fa]">
                  {(ad.imageUrl || ad.thumbnailUrl) ? (
                    <img
                      src={ad.imageUrl || ad.thumbnailUrl || ''}
                      alt={ad.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#9d9da8] text-[10px]">
                      No preview
                    </div>
                  )}
                  {ad.isVideo && (
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/70 text-white text-[9px] font-semibold rounded">
                      VIDEO
                    </div>
                  )}
                  <div className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                    ad.isTop ? 'bg-[#16a34a]/90 text-white' : 'bg-[#dc2626]/90 text-white'
                  }`}>
                    {ad.isTop ? 'TOP' : 'LOW'}
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-[11px] font-semibold text-[#111113] truncate">{ad.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-[#9d9da8]">${ad.spend.toFixed(0)} spent</span>
                    <span className={`text-[10px] font-semibold ${ad.results > 0 ? 'text-[#111113]' : 'text-[#dc2626]'}`}>
                      {ad.results > 0 ? `$${ad.cpr.toFixed(2)} CPR` : '0 results'}
                    </span>
                  </div>
                  {ad.age !== null && (
                    <span className="text-[9px] text-[#9d9da8]">{ad.age}d old</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status message during processing */}
      {statusMessage && analyzing && (
        <div className="flex items-center gap-3 px-4 py-3 border border-[#e8e8ec] rounded bg-[#f8f8fa]">
          <div className="w-2 h-2 bg-[#2563eb] rounded-full animate-pulse flex-shrink-0" />
          <span className="text-[12px] text-[#111113]">{statusMessage}</span>
        </div>
      )}

      {/* Analysis output */}
      {(analysis || (analyzing && !statusMessage)) && (
        <div className="border border-[#e8e8ec] rounded bg-white">
          <div className="px-4 py-2 border-b border-[#e8e8ec] bg-[#f8f8fa] flex items-center justify-between">
            <h3 className="text-[11px] font-semibold text-[#9d9da8] uppercase tracking-wider">Analysis</h3>
            {analyzing && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[#2563eb] rounded-full animate-pulse" />
                <span className="text-[10px] text-[#9d9da8]">Analyzing creatives...</span>
              </div>
            )}
          </div>
          <div
            ref={analysisRef}
            className="p-4 sm:p-6 max-h-[600px] overflow-y-auto text-[13px] leading-relaxed text-[#111113]"
            dangerouslySetInnerHTML={{ __html: analysis ? formatAnalysis(analysis) : '<span class="text-[#9d9da8]">Waiting for analysis...</span>' }}
          />
        </div>
      )}

      {/* Empty state */}
      {!analyzing && !analysis && ads.length === 0 && (
        <div className="border border-dashed border-[#e8e8ec] rounded p-8 text-center">
          <p className="text-[13px] text-[#9d9da8]">Select a time period and click "Analyze Creatives" to get AI-powered visual analysis of your ad creatives.</p>
          <p className="text-[11px] text-[#9d9da8] mt-2">Gemini will analyze your top performers and underperformers, identifying visual patterns that drive results.</p>
        </div>
      )}
    </div>
  )
}
