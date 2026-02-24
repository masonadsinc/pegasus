'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ClientOption {
  id: string
  name: string
  slug: string
  industry: string | null
  location: string | null
  weeklySpend: number
  weeklyResults: number
}

const QUICK_ACTIONS = [
  { label: 'Performance overview', prompt: 'Give me a full performance overview for this client. How are they doing vs targets?' },
  { label: 'What needs attention?', prompt: 'What needs immediate attention on this account? Flag any issues with specific recommendations.' },
  { label: 'Optimization ideas', prompt: 'Based on the current data, what are the top optimization actions I should take for this client this week?' },
  { label: 'Creative analysis', prompt: 'Analyze the creative performance. Which ads are working, which are underperforming, and what patterns do you see?' },
  { label: 'Budget recommendation', prompt: 'Should I increase or decrease budget on this account? Show me the math and reasoning.' },
  { label: 'Weekly summary', prompt: 'Give me a weekly summary I could send to this client. Professional, data-driven, with clear next steps.' },
]

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return <p key={i} className="text-[13px] font-semibold text-[#111113] mt-3 mb-1">{line.slice(3)}</p>
        }
        if (line.startsWith('### ')) {
          return <p key={i} className="text-[12px] font-semibold text-[#111113] mt-2 mb-1">{line.slice(4)}</p>
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          const formatted = line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`(.*?)`/g, '<code class="bg-[#f4f4f6] px-1 rounded text-[11px]">$1</code>')
          return <p key={i} className="text-[12px] text-[#6b6b76] pl-3 leading-relaxed" dangerouslySetInnerHTML={{ __html: '&bull; ' + formatted }} />
        }
        if (/^\d+\.\s/.test(line)) {
          const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`(.*?)`/g, '<code class="bg-[#f4f4f6] px-1 rounded text-[11px]">$1</code>')
          return <p key={i} className="text-[12px] text-[#6b6b76] pl-3 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatted }} />
        }
        if (line.trim() === '') return <div key={i} className="h-1" />
        const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-[#111113]">$1</strong>').replace(/`(.*?)`/g, '<code class="bg-[#f4f4f6] px-1 rounded text-[11px]">$1</code>')
        return <p key={i} className="text-[12px] text-[#6b6b76] leading-relaxed" dangerouslySetInnerHTML={{ __html: formatted }} />
      })}
    </div>
  )
}

export function PegasusChat({ clients }: { clients: ClientOption[] }) {
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (selectedClient) inputRef.current?.focus()
  }, [selectedClient])

  function selectClient(client: ClientOption) {
    setSelectedClient(client)
    setMessages([])
    setInput('')
  }

  function switchClient() {
    setSelectedClient(null)
    setMessages([])
    setSearch('')
  }

  async function sendMessage(content: string) {
    if (!content.trim() || loading || !selectedClient) return

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
          messages: newMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          clientId: selectedClient.id,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setMessages([...newMessages, {
          id: (Date.now() + 1).toString(), role: 'assistant',
          content: data.error || 'Something went wrong. Check your Gemini API key in Settings > Agency.',
          timestamp: new Date(),
        }])
        setLoading(false)
        return
      }

      // Streaming response
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''
      const assistantId = (Date.now() + 1).toString()

      setMessages([...newMessages, { id: assistantId, role: 'assistant', content: '', timestamp: new Date() }])

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          // Parse SSE data lines
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') break
              try {
                const parsed = JSON.parse(data)
                if (parsed.text) {
                  assistantContent += parsed.text
                  setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m))
                }
              } catch {}
            }
          }
        }
      }

      // If no streaming content came through (non-streaming fallback)
      if (!assistantContent) {
        try {
          const text = decoder.decode()
          const data = JSON.parse(text)
          assistantContent = data.content || 'No response generated.'
        } catch {
          assistantContent = assistantContent || 'No response generated.'
        }
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m))
      }
    } catch {
      setMessages(prev => [...prev.filter(m => m.role !== 'assistant' || m.content), {
        id: (Date.now() + 1).toString(), role: 'assistant' as const,
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

  const filteredClients = search
    ? clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : clients

  // CLIENT SELECTOR STATE
  if (!selectedClient) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-44px)]">
        <div className="max-w-[480px] w-full px-6">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-md bg-[#111113] flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
            </div>
            <h2 className="text-[20px] font-semibold text-[#111113] mb-1">Pegasus AI</h2>
            <p className="text-[13px] text-[#9d9da8]">Select a client to begin analysis</p>
          </div>

          <div className="relative mb-3">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9d9da8] pointer-events-none" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4 4" /></svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search clients..."
              autoFocus
              className="w-full pl-9 pr-3 py-2.5 rounded-md bg-[#f8f8fa] border border-[#e8e8ec] text-[13px] text-[#111113] focus:outline-none focus:border-[#2563eb] transition-colors placeholder-[#9d9da8]"
            />
          </div>

          <div className="rounded-md border border-[#e8e8ec] bg-white overflow-hidden max-h-[400px] overflow-y-auto">
            {filteredClients.map(client => (
              <button
                key={client.id}
                onClick={() => selectClient(client)}
                className="w-full text-left px-4 py-3 hover:bg-[#fafafb] transition-colors border-b border-[#f4f4f6] last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-medium text-[#111113]">{client.name}</p>
                  {client.weeklySpend > 0 ? (
                    <span className="text-[10px] tabular-nums text-[#6b6b76]">${client.weeklySpend.toFixed(0)}/wk</span>
                  ) : (
                    <span className="text-[10px] text-[#c4c4cc]">No spend</span>
                  )}
                </div>
                <p className="text-[11px] text-[#9d9da8] mt-0.5">
                  {[client.industry, client.location].filter(Boolean).join(' · ') || 'No details'}
                  {client.weeklyResults > 0 && ` · ${client.weeklyResults} results`}
                </p>
              </button>
            ))}
            {filteredClients.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-[13px] text-[#9d9da8]">No clients found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // CHAT STATE
  return (
    <div className="flex flex-col h-[calc(100vh-44px)]">
      {/* Client header bar */}
      <div className="border-b border-[#e8e8ec] px-4 sm:px-6 py-2.5 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={switchClient} className="text-[#9d9da8] hover:text-[#111113] transition-colors" title="Switch client">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 2L4 8l6 6" /></svg>
          </button>
          <div>
            <p className="text-[13px] font-semibold text-[#111113]">{selectedClient.name}</p>
            <p className="text-[10px] text-[#9d9da8]">
              {[selectedClient.industry, selectedClient.location].filter(Boolean).join(' · ')}
              {selectedClient.weeklySpend > 0 ? ` · $${selectedClient.weeklySpend.toFixed(0)}/wk` : ' · No recent spend'}
            </p>
          </div>
        </div>
        <button
          onClick={switchClient}
          className="px-3 py-1.5 rounded text-[11px] font-medium text-[#6b6b76] hover:text-[#111113] hover:bg-[#f4f4f6] transition-colors"
        >
          Switch Client
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6">
            <div className="max-w-[560px] w-full text-center">
              <div className="w-10 h-10 rounded-md bg-[#111113] flex items-center justify-center mx-auto mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
              </div>
              <p className="text-[13px] text-[#9d9da8] mb-6">What do you want to know about {selectedClient.name}?</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
          <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-6 space-y-6">
            {messages.map(msg => (
              <div key={msg.id} className="flex gap-3">
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
      <div className="border-t border-[#e8e8ec] px-4 sm:px-6 py-4 bg-white">
        <div className="max-w-[720px] mx-auto">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask about ${selectedClient.name}...`}
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
          <p className="text-[10px] text-[#c4c4cc] mt-1.5 text-center">Analysis scoped to {selectedClient.name}. Powered by Gemini.</p>
        </div>
      </div>
    </div>
  )
}
