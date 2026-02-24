'use client'

import { useState, useRef, useEffect } from 'react'
import { formatCurrency, formatNumber } from '@/lib/utils'
import Link from 'next/link'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ClientSummary {
  name: string
  slug: string
  spend: number
  results: number
  cpr: number
  target: number | null
  onTarget: boolean | null
}

interface Summary {
  totalSpend: number
  totalResults: number
  activeCount: number
  criticalCount: number
  clients: ClientSummary[]
}

const QUICK_ACTIONS = [
  { label: 'Morning briefing', prompt: 'Give me a morning briefing. What happened across all accounts? What needs my attention today?' },
  { label: 'Who needs attention?', prompt: 'Which accounts need immediate attention? Rank them by urgency and tell me exactly what to do for each.' },
  { label: 'Weekly performance', prompt: 'Give me a full weekly performance summary. Compare this week vs last week for every account.' },
  { label: 'Optimization ideas', prompt: 'Based on the current data, what are the top 5 optimization actions I should take across all accounts this week?' },
  { label: 'Budget allocation', prompt: 'Analyze the current spend distribution. Which accounts should I increase budget on and which should I pull back? Show me the math.' },
  { label: 'Creative insights', prompt: 'What patterns do you see in ad performance? Which creative approaches seem to be working best across accounts?' },
]

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function MarkdownContent({ content }: { content: string }) {
  // Simple markdown: **bold**, ## headers, - lists, backticks
  const lines = content.split('\n')
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return <p key={i} className="text-[13px] font-semibold text-[#111113] mt-3 mb-1">{line.slice(3)}</p>
        }
        if (line.startsWith('- ')) {
          const formatted = line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`(.*?)`/g, '<code class="bg-[#f4f4f6] px-1 rounded text-[11px]">$1</code>')
          return <p key={i} className="text-[12px] text-[#6b6b76] pl-3 leading-relaxed" dangerouslySetInnerHTML={{ __html: '• ' + formatted }} />
        }
        if (line.trim() === '') return <div key={i} className="h-1" />
        const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-[#111113]">$1</strong>').replace(/`(.*?)`/g, '<code class="bg-[#f4f4f6] px-1 rounded text-[11px]">$1</code>')
        return <p key={i} className="text-[12px] text-[#6b6b76] leading-relaxed" dangerouslySetInnerHTML={{ __html: formatted }} />
      })}
    </div>
  )
}

export function PegasusChat({ summary }: { summary: Summary }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function sendMessage(content: string) {
    if (!content.trim() || loading) return

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: content.trim(), timestamp: new Date() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/pegasus/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessages([...newMessages, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.error || 'Something went wrong. Check your Gemini API key in Settings > Agency.',
          timestamp: new Date(),
        }])
      } else {
        setMessages([...newMessages, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.content,
          timestamp: new Date(),
        }])
      }
    } catch {
      setMessages([...newMessages, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Failed to connect to the AI service. Please try again.',
        timestamp: new Date(),
      }])
    }

    setLoading(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const blendedCpr = summary.totalResults > 0 ? summary.totalSpend / summary.totalResults : 0

  return (
    <div className="flex h-[calc(100vh-44px)]">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            /* Welcome State */
            <div className="flex flex-col items-center justify-center h-full px-6">
              <div className="max-w-[560px] w-full text-center">
                <div className="w-12 h-12 rounded-md bg-[#111113] flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                </div>
                <h2 className="text-[20px] font-semibold text-[#111113] mb-1">Pegasus</h2>
                <p className="text-[13px] text-[#9d9da8] mb-8">AI-powered agency operations. Ask anything about your accounts.</p>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3 mb-8">
                  <div className="rounded-md bg-[#f8f8fa] border border-[#e8e8ec] p-3">
                    <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">Weekly Spend</p>
                    <p className="text-[16px] font-semibold tabular-nums text-[#111113] mt-0.5">{formatCurrency(summary.totalSpend)}</p>
                  </div>
                  <div className="rounded-md bg-[#f8f8fa] border border-[#e8e8ec] p-3">
                    <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">Results</p>
                    <p className="text-[16px] font-semibold tabular-nums text-[#111113] mt-0.5">{formatNumber(summary.totalResults)}</p>
                  </div>
                  <div className="rounded-md bg-[#f8f8fa] border border-[#e8e8ec] p-3">
                    <p className="text-[10px] text-[#9d9da8] font-medium uppercase tracking-wider">Needs Attention</p>
                    <p className={`text-[16px] font-semibold tabular-nums mt-0.5 ${summary.criticalCount > 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{summary.criticalCount}</p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_ACTIONS.map(action => (
                    <button
                      key={action.label}
                      onClick={() => sendMessage(action.prompt)}
                      className="text-left px-3.5 py-2.5 rounded-md border border-[#e8e8ec] hover:bg-[#f8f8fa] hover:border-[#d4d4d8] transition-all text-[12px]"
                    >
                      <span className="text-[#111113] font-medium">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Chat Messages */
            <div className="max-w-[720px] mx-auto px-6 py-6 space-y-6">
              {messages.map(msg => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? '' : ''}`}>
                  <div className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    msg.role === 'assistant' ? 'bg-[#111113]' : 'bg-[#2563eb]'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                    ) : (
                      <span className="text-white text-[10px] font-semibold">You</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[12px] font-semibold text-[#111113]">{msg.role === 'assistant' ? 'Pegasus' : 'You'}</span>
                      <span className="text-[10px] text-[#c4c4cc]">{formatTime(msg.timestamp)}</span>
                    </div>
                    {msg.role === 'assistant' ? (
                      <MarkdownContent content={msg.content} />
                    ) : (
                      <p className="text-[12px] text-[#6b6b76] leading-relaxed">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded bg-[#111113] flex items-center justify-center flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                  </div>
                  <div className="flex items-center gap-1.5 pt-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#9d9da8] animate-pulse" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#9d9da8] animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#9d9da8] animate-pulse" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-[#e8e8ec] px-6 py-4 bg-white">
          <div className="max-w-[720px] mx-auto">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Pegasus anything about your accounts..."
                rows={1}
                className="w-full px-4 py-3 pr-12 rounded-md bg-[#f8f8fa] border border-[#e8e8ec] text-[13px] text-[#111113] focus:outline-none focus:border-[#2563eb] focus:bg-white transition-colors resize-none placeholder-[#9d9da8]"
                style={{ minHeight: '44px', maxHeight: '120px' }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded flex items-center justify-center bg-[#111113] text-white hover:bg-[#333] disabled:opacity-30 disabled:hover:bg-[#111113] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2L2 8.5l4.5 2L10 14l4-12z" /></svg>
              </button>
            </div>
            <p className="text-[10px] text-[#c4c4cc] mt-1.5 text-center">Pegasus has access to all your account data. Powered by Gemini.</p>
          </div>
        </div>
      </div>

      {/* Sidebar — Account Quick View */}
      <div className={`border-l border-[#e8e8ec] bg-[#fafafb] transition-all duration-200 overflow-hidden ${sidebarOpen ? 'w-[260px]' : 'w-0'}`}>
        <div className="w-[260px] h-full flex flex-col">
          <div className="px-4 py-3 border-b border-[#e8e8ec] flex items-center justify-between">
            <h3 className="text-[11px] font-semibold text-[#9d9da8] uppercase tracking-wider">Accounts</h3>
            <button onClick={() => setSidebarOpen(false)} className="text-[#9d9da8] hover:text-[#111113]">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {summary.clients.map(c => (
              <Link key={c.slug} href={`/clients/${c.slug}`} className="block px-4 py-2.5 hover:bg-white transition-colors border-b border-[#f0f0f2]">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[12px] font-medium text-[#111113] truncate pr-2">{c.name}</span>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.onTarget === true ? 'bg-[#16a34a]' : c.onTarget === false ? 'bg-[#dc2626]' : 'bg-[#d4d4d8]'}`} />
                </div>
                <div className="flex items-center gap-3 text-[10px] text-[#9d9da8] tabular-nums">
                  <span>{formatCurrency(c.spend)}</span>
                  <span>{c.results} results</span>
                  <span className={c.onTarget === false ? 'text-[#dc2626]' : ''}>{c.cpr > 0 ? formatCurrency(c.cpr) : '—'}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Sidebar toggle when collapsed */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed right-4 top-14 z-20 w-8 h-8 rounded bg-white border border-[#e8e8ec] shadow-sm flex items-center justify-center hover:bg-[#f4f4f6]"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#6b6b76" strokeWidth="2" strokeLinecap="round"><path d="M3 4h10M3 8h10M3 12h10" /></svg>
        </button>
      )}
    </div>
  )
}
