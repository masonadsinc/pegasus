'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface OnboardingStatus {
  hasTimezone: boolean
  hasGeminiKey: boolean
  hasClients: boolean
  hasAccounts: boolean
  hasSyncRun: boolean
  hasReport: boolean
  dismissed: boolean
}

const steps = [
  { key: 'hasTimezone', label: 'Set your timezone', href: '/settings/agency', desc: 'Configure your organization timezone' },
  { key: 'hasGeminiKey', label: 'Add AI key', href: '/settings/agency#ai', desc: 'Add a Gemini API key for AI features' },
  { key: 'hasClients', label: 'Add a client', href: '/settings/clients', desc: 'Create your first client' },
  { key: 'hasAccounts', label: 'Connect Meta account', href: '/settings/clients', desc: 'Link a Meta ad account to a client' },
  { key: 'hasSyncRun', label: 'Run first data sync', href: '/settings/sync', desc: 'Pull ad performance data from Meta' },
  { key: 'hasReport', label: 'Generate a report', href: '/reports', desc: 'Create your first client report' },
] as const

export function OnboardingChecklist() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [hiding, setHiding] = useState(false)

  useEffect(() => {
    fetch('/api/onboarding').then(r => r.ok ? r.json() : null).then(d => d && setStatus(d)).catch(() => {})
  }, [])

  if (!status || status.dismissed) return null

  const completed = steps.filter(s => status[s.key as keyof OnboardingStatus]).length
  const total = steps.length
  const allDone = completed === total

  if (allDone) return null

  async function dismiss() {
    setHiding(true)
    await fetch('/api/onboarding', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dismissed: true }) })
    setStatus(s => s ? { ...s, dismissed: true } : s)
  }

  return (
    <div className={`bg-white border border-[#e8e8ec] rounded-md p-5 mb-6 transition-opacity ${hiding ? 'opacity-0' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[14px] font-semibold text-[#111113]">Get started</h3>
          <p className="text-[11px] text-[#9d9da8] mt-0.5">{completed} of {total} steps complete</p>
        </div>
        <button onClick={dismiss} className="text-[11px] text-[#9d9da8] hover:text-[#111113] px-2 py-1 rounded hover:bg-[#f4f4f6] transition-colors">
          Dismiss
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-[#f4f4f6] rounded-full overflow-hidden mb-4">
        <div className="h-full rounded-full bg-[#2563eb] transition-all duration-500" style={{ width: `${(completed / total) * 100}%` }} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {steps.map(step => {
          const done = status[step.key as keyof OnboardingStatus] as boolean
          return (
            <Link
              key={step.key}
              href={step.href}
              className={`flex items-start gap-2.5 p-3 rounded-md border transition-colors ${
                done
                  ? 'border-[#bbf7d0] bg-[#f0fdf4]'
                  : 'border-[#e8e8ec] hover:border-[#2563eb]/30 hover:bg-[#f9f9fb]'
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                done ? 'bg-[#16a34a]' : 'border-2 border-[#d4d4d8]'
              }`}>
                {done && <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M2 6l3 3 5-5" /></svg>}
              </div>
              <div>
                <p className={`text-[12px] font-medium ${done ? 'text-[#16a34a]' : 'text-[#111113]'}`}>{step.label}</p>
                <p className="text-[10px] text-[#9d9da8] mt-0.5">{step.desc}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
