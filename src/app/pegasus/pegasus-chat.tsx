'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Attachment {
  name: string
  dataUrl: string
  mimeType: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  imageData?: string
  attachments?: Attachment[]
  timestamp: string
}

interface Conversation {
  id: string
  client_id: string
  title: string
  days: number
  created_at: string
  updated_at: string
  clients?: { name: string }
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
  { label: 'Monday action plan', prompt: 'What do I need to do on this account TODAY? Give me a prioritized action list — what to pause, what to scale, what to test. Be specific with ad names and campaign names.' },
  { label: 'Spend audit', prompt: 'Audit the spend on this account. Where is money being wasted on non-converting ads? What should I pause immediately?' },
  { label: 'Creative deep dive', prompt: 'Analyze the creative strategy. Which angles and hooks are winning? Is there creative fatigue? What new creative concepts should we test?' },
  { label: 'Scaling analysis', prompt: 'Can we scale this account? What campaigns/ad sets have headroom? What would happen if we increased budget 30%?' },
  { label: 'Diagnose performance', prompt: 'Diagnose the current performance. Is CPR trending better or worse? WHY? Walk me through the funnel: impressions → clicks → conversions.' },
  { label: 'Client report draft', prompt: 'Draft a weekly performance update I can send to this client. Lead with wins, be honest about challenges, and outline specific next steps.' },
]

const DATE_RANGES = [
  { label: '7d', value: 7 },
  { label: '14d', value: 14 },
  { label: '30d', value: 30 },
  { label: '60d', value: 60 },
  { label: '90d', value: 90 },
]

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatRelative(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) return <p key={i} className="text-[13px] font-semibold text-[#111113] mt-3 mb-1">{line.slice(3)}</p>
        if (line.startsWith('### ')) return <p key={i} className="text-[12px] font-semibold text-[#111113] mt-2 mb-1">{line.slice(4)}</p>
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

export function PegasusChat({ clients, initialClientId }: { clients: ClientOption[]; initialClientId?: string }) {
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(
    initialClientId ? clients.find(c => c.id === initialClientId) || null : null
  )
  const [days, setDays] = useState(7)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [convSearch, setConvSearch] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (selectedClient) {
      inputRef.current?.focus()
      loadConversations()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient])

  const loadConversations = useCallback(async () => {
    if (!selectedClient) return
    try {
      const res = await fetch(`/api/pegasus/conversations?clientId=${selectedClient.id}`)
      if (res.ok) setConversations(await res.json())
    } catch {}
  }, [selectedClient])

  async function saveConversation(msgs: Message[], title?: string) {
    if (!selectedClient || msgs.length === 0) return

    // Strip imageData and attachments from messages before saving (too large for DB)
    const saveMsgs = msgs.map(m => {
      const cleaned = { ...m }
      if (cleaned.imageData) { cleaned.imageData = undefined; if (!cleaned.content) cleaned.content = '[Generated image]' }
      if (cleaned.attachments?.length) { cleaned.content = `[${cleaned.attachments.length} file(s) attached] ${cleaned.content}`; cleaned.attachments = undefined }
      return cleaned
    })
    const convTitle = title || msgs.find(m => m.role === 'user')?.content.slice(0, 60) || 'New conversation'

    if (activeConvId) {
      await fetch('/api/pegasus/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeConvId, messages: saveMsgs, title: convTitle }),
      })
    } else {
      const res = await fetch('/api/pegasus/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClient.id, title: convTitle, messages: saveMsgs, days }),
      })
      if (res.ok) {
        const conv = await res.json()
        setActiveConvId(conv.id)
      }
    }
    loadConversations()
  }

  async function loadConversation(conv: Conversation) {
    setActiveConvId(conv.id)
    setDays(conv.days)
    try {
      const res = await fetch(`/api/pegasus/conversations?id=${conv.id}`)
      if (res.ok) {
        const data = await res.json()
        if (data.messages && Array.isArray(data.messages)) {
          setMessages(data.messages)
        }
      }
    } catch {}
  }

  async function deleteConversation(id: string) {
    await fetch(`/api/pegasus/conversations?id=${id}`, { method: 'DELETE' })
    if (activeConvId === id) {
      setActiveConvId(null)
      setMessages([])
    }
    loadConversations()
  }

  function startNewConversation() {
    setActiveConvId(null)
    setMessages([])
    setInput('')
  }

  function selectClient(client: ClientOption) {
    setSelectedClient(client)
    setMessages([])
    setInput('')
    setActiveConvId(null)
  }

  function switchClient() {
    setSelectedClient(null)
    setMessages([])
    setSearch('')
    setActiveConvId(null)
    setConversations([])
  }

  function handleFileSelect(files: FileList | null) {
    if (!files) return
    const maxFiles = 6 - attachments.length
    Array.from(files).slice(0, maxFiles).forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        setAttachments(prev => [...prev, {
          name: file.name,
          dataUrl: reader.result as string,
          mimeType: file.type,
        }].slice(0, 6))
      }
      reader.readAsDataURL(file)
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function sendMessage(content: string) {
    if ((!content.trim() && attachments.length === 0) || loading || !selectedClient) return

    const currentAttachments = [...attachments]
    const userMsg: Message = {
      id: Date.now().toString(), role: 'user', content: content.trim(),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      timestamp: new Date().toISOString(),
    }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setAttachments([])
    setLoading(true)

    try {
      const res = await fetch('/api/pegasus/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          clientId: selectedClient.id,
          days,
          attachments: currentAttachments.map(a => ({ dataUrl: a.dataUrl, mimeType: a.mimeType, name: a.name })),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        const errMessages = [...newMessages, {
          id: (Date.now() + 1).toString(), role: 'assistant' as const,
          content: data.error || 'Something went wrong.',
          timestamp: new Date().toISOString(),
        }]
        setMessages(errMessages)
        setLoading(false)
        return
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''
      const assistantId = (Date.now() + 1).toString()

      setMessages([...newMessages, { id: assistantId, role: 'assistant', content: '', timestamp: new Date().toISOString() }])

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') break
              try {
                const parsed = JSON.parse(data)
                if (parsed.image) {
                  setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, imageData: parsed.image } : m))
                }
                if (parsed.text) {
                  assistantContent += parsed.text
                  setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m))
                }
              } catch {}
            }
          }
        }
      }

      if (!assistantContent) {
        assistantContent = 'No response generated.'
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m))
      }

      // Auto-save conversation
      const finalMessages = [...newMessages, { id: assistantId, role: 'assistant' as const, content: assistantContent, timestamp: new Date().toISOString() }]
      setMessages(finalMessages)
      saveConversation(finalMessages)
    } catch {
      setMessages(prev => [...prev.filter(m => m.role !== 'assistant' || m.content), {
        id: (Date.now() + 1).toString(), role: 'assistant' as const,
        content: 'Failed to connect. Please try again.',
        timestamp: new Date().toISOString(),
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

  const filteredConvs = convSearch
    ? conversations.filter(c => c.title.toLowerCase().includes(convSearch.toLowerCase()))
    : conversations

  // CLIENT SELECTOR
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
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..." autoFocus
              className="w-full pl-9 pr-3 py-2.5 rounded-md bg-[#f8f8fa] border border-[#e8e8ec] text-[13px] text-[#111113] focus:outline-none focus:border-[#2563eb] transition-colors placeholder-[#9d9da8]" />
          </div>

          <div className="rounded-md border border-[#e8e8ec] bg-white overflow-hidden max-h-[400px] overflow-y-auto">
            {filteredClients.map(client => (
              <button key={client.id} onClick={() => selectClient(client)}
                className="w-full text-left px-4 py-3 hover:bg-[#fafafb] transition-colors border-b border-[#f4f4f6] last:border-b-0">
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
            {filteredClients.length === 0 && <div className="px-4 py-8 text-center"><p className="text-[13px] text-[#9d9da8]">No clients found</p></div>}
          </div>
        </div>
      </div>
    )
  }

  // CHAT LAYOUT
  return (
    <div className="flex h-[calc(100vh-44px)]">
      {/* Sidebar — conversation history */}
      <div className={`${sidebarOpen ? 'w-[280px]' : 'w-0'} border-r border-[#e8e8ec] bg-[#fafafb] flex-shrink-0 transition-all duration-200 overflow-hidden flex flex-col`}>
        <div className="p-3 border-b border-[#e8e8ec]">
          <button onClick={startNewConversation}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-[#e8e8ec] bg-white hover:bg-[#f4f4f6] transition-colors text-[12px] font-medium text-[#111113]">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
            New conversation
          </button>
        </div>

        {conversations.length > 3 && (
          <div className="px-3 pt-2">
            <input value={convSearch} onChange={e => setConvSearch(e.target.value)} placeholder="Search conversations..."
              className="w-full px-2.5 py-1.5 rounded bg-white border border-[#e8e8ec] text-[11px] text-[#111113] focus:outline-none focus:border-[#2563eb] placeholder-[#c4c4cc]" />
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {filteredConvs.length === 0 && (
            <div className="px-3 py-6 text-center">
              <p className="text-[11px] text-[#c4c4cc]">No conversations yet</p>
            </div>
          )}
          {filteredConvs.map(conv => (
            <div key={conv.id}
              className={`group flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors ${
                activeConvId === conv.id ? 'bg-[#111113] text-white' : 'hover:bg-[#f0f0f2] text-[#6b6b76]'
              }`}
              onClick={() => loadConversation(conv)}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="flex-shrink-0 opacity-50">
                <path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H6l-3 2V6" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-medium truncate ${activeConvId === conv.id ? 'text-white' : 'text-[#111113]'}`}>
                  {conv.title}
                </p>
                <p className={`text-[10px] truncate ${activeConvId === conv.id ? 'text-white/60' : 'text-[#9d9da8]'}`}>
                  {formatRelative(conv.updated_at)}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id) }}
                className={`opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity ${
                  activeConvId === conv.id ? 'hover:bg-white/10 text-white/60' : 'hover:bg-[#e8e8ec] text-[#9d9da8]'
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
              </button>
            </div>
          ))}
        </div>

        {/* Client info at bottom */}
        <div className="p-3 border-t border-[#e8e8ec]">
          <button onClick={switchClient} className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-[#f0f0f2] transition-colors">
            <div className="w-6 h-6 rounded bg-[#2563eb] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[9px] font-semibold">{selectedClient.name.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[11px] font-medium text-[#111113] truncate">{selectedClient.name}</p>
              <p className="text-[10px] text-[#9d9da8]">Switch client</p>
            </div>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#9d9da8" strokeWidth="2" strokeLinecap="round"><path d="M6 4l4 4-4 4" /></svg>
          </button>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b border-[#e8e8ec] px-4 py-2.5 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded hover:bg-[#f4f4f6] transition-colors text-[#9d9da8]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {sidebarOpen
                  ? <><path d="M2 3h12M2 8h12M2 13h12" /></>
                  : <><path d="M2 3h12M2 8h12M2 13h12" /></>
                }
              </svg>
            </button>
            <div>
              <p className="text-[13px] font-semibold text-[#111113]">{selectedClient.name}</p>
              <p className="text-[10px] text-[#9d9da8]">
                {selectedClient.weeklySpend > 0 ? `$${selectedClient.weeklySpend.toFixed(0)}/wk` : 'No recent spend'}
                {selectedClient.weeklyResults > 0 ? ` · ${selectedClient.weeklyResults} results` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded border border-[#e8e8ec] overflow-hidden">
              {DATE_RANGES.map(r => (
                <button key={r.value} onClick={() => setDays(r.value)}
                  className={`px-2 py-1 text-[10px] font-medium transition-colors ${
                    days === r.value ? 'bg-[#111113] text-white' : 'text-[#9d9da8] hover:text-[#111113] hover:bg-[#f4f4f6]'
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
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
                    <button key={action.label} onClick={() => sendMessage(action.prompt)}
                      className="text-left px-3.5 py-2.5 rounded-md border border-[#e8e8ec] hover:bg-[#f8f8fa] hover:border-[#d4d4d8] transition-all text-[12px]">
                      <span className="text-[#111113] font-medium">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-6 space-y-6">
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
                    {msg.imageData && (
                      <div className="my-2 group relative">
                        <img src={msg.imageData} alt="Generated" className="rounded-md max-w-full max-h-[400px] object-contain border border-[#e8e8ec]" />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a href={msg.imageData} download="pegasus-image.png" className="bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-medium text-[#111113] hover:bg-white shadow-sm">Download</a>
                        </div>
                      </div>
                    )}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {msg.attachments.filter(a => a.mimeType.startsWith('image/')).map((att, i) => (
                          <img key={i} src={att.dataUrl} alt={att.name} className="w-20 h-20 rounded object-cover border border-[#e8e8ec]" />
                        ))}
                        {msg.attachments.filter(a => !a.mimeType.startsWith('image/')).map((att, i) => (
                          <div key={i} className="px-2 py-1 rounded bg-[#f4f4f6] border border-[#e8e8ec] text-[10px] text-[#6b6b76]">{att.name}</div>
                        ))}
                      </div>
                    )}
                    {msg.role === 'assistant' ? <MarkdownContent content={msg.content} /> : (
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
        <div className="border-t border-[#e8e8ec] px-4 sm:px-6 py-3 bg-white">
          <div className="max-w-[760px] mx-auto">
            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1">
                {attachments.map((att, i) => (
                  <div key={i} className="relative flex-shrink-0">
                    {att.mimeType.startsWith('image/') ? (
                      <img src={att.dataUrl} className="w-12 h-12 rounded object-cover border border-[#e8e8ec]" />
                    ) : (
                      <div className="w-12 h-12 rounded border border-[#e8e8ec] bg-[#f4f4f6] flex items-center justify-center">
                        <svg className="w-5 h-5 text-[#9d9da8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                    )}
                    <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#dc2626] text-white rounded-full text-[9px] flex items-center justify-center hover:bg-[#b91c1c]">
                      x
                    </button>
                  </div>
                ))}
                <span className="text-[10px] text-[#9d9da8]">{attachments.length}/6</span>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf,.csv,.txt" multiple
                onChange={e => handleFileSelect(e.target.files)} />
              <button onClick={() => fileInputRef.current?.click()} disabled={loading || attachments.length >= 6}
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded border border-[#e8e8ec] bg-[#f8f8fa] text-[#9d9da8] hover:text-[#111113] hover:border-[#111113] transition-colors disabled:opacity-40"
                title="Attach files">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <div className="relative flex-1">
                <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder={`Ask about ${selectedClient.name}...`} rows={1}
                  className="w-full px-4 py-3 pr-12 rounded-md bg-[#f8f8fa] border border-[#e8e8ec] text-[13px] text-[#111113] focus:outline-none focus:border-[#2563eb] focus:bg-white transition-colors resize-none placeholder-[#9d9da8]"
                  style={{ minHeight: '44px', maxHeight: '120px' }} />
                <button onClick={() => sendMessage(input)} disabled={(!input.trim() && attachments.length === 0) || loading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded flex items-center justify-center bg-[#111113] text-white hover:bg-[#333] disabled:opacity-30 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2L2 8.5l4.5 2L10 14l4-12z" /></svg>
                </button>
              </div>
            </div>
            <p className="text-[10px] text-[#c4c4cc] mt-1.5 text-center">Analyzing {days}d of data for {selectedClient.name}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
