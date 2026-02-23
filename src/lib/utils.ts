import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, decimals?: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? (value < 10 ? 2 : 0)
  }).format(value)
}

export function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}K`
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(0)
}

// 4-tier status system
export type StatusTier = 'excellent' | 'good' | 'warning' | 'critical' | 'neutral'

export function cplStatusTier(actual: number, target: number): StatusTier {
  if (!target || !actual) return 'neutral'
  const ratio = actual / target
  if (ratio <= 0.85) return 'excellent'
  if (ratio <= 1.0) return 'good'
  if (ratio <= 1.25) return 'warning'
  return 'critical'
}

export function roasStatusTier(actual: number, target: number): StatusTier {
  if (!target || !actual) return 'neutral'
  const ratio = actual / target
  if (ratio >= 1.25) return 'excellent'
  if (ratio >= 1.0) return 'good'
  if (ratio >= 0.75) return 'warning'
  return 'critical'
}

// Legacy 3-tier (for backward compat with dashboard)
export function cplStatus(actual: number, target: number): 'green' | 'yellow' | 'red' {
  if (!target || !actual) return 'green'
  const ratio = actual / target
  if (ratio <= 1.0) return 'green'
  if (ratio <= 1.3) return 'yellow'
  return 'red'
}

export function roasStatus(actual: number, target: number): 'green' | 'yellow' | 'red' {
  if (!target || !actual) return 'green'
  const ratio = actual / target
  if (ratio >= 1.0) return 'green'
  if (ratio >= 0.7) return 'yellow'
  return 'red'
}

export const statusConfig: Record<StatusTier, { dot: string; bg: string; text: string; border: string; label: string }> = {
  excellent: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', label: 'Excellent' },
  good: { dot: 'bg-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', label: 'Good' },
  warning: { dot: 'bg-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', label: 'Warning' },
  critical: { dot: 'bg-red-500', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', label: 'Critical' },
  neutral: { dot: 'bg-zinc-500', bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/20', label: 'No Data' },
}

export function statusDot(status: 'green' | 'yellow' | 'red'): string {
  const map = { green: 'bg-emerald-500', yellow: 'bg-amber-500', red: 'bg-red-500' }
  return map[status]
}

// Grade system: A/B/C/D/F based on CPL ratio to target
export function grade(ratio: number): { letter: string; color: string } {
  if (ratio <= 0.7) return { letter: 'A', color: 'text-emerald-400' }
  if (ratio <= 0.9) return { letter: 'B', color: 'text-blue-400' }
  if (ratio <= 1.1) return { letter: 'C', color: 'text-amber-400' }
  if (ratio <= 1.3) return { letter: 'D', color: 'text-orange-400' }
  return { letter: 'F', color: 'text-red-400' }
}

// ROAS grade (inverted — higher is better)
export function roasGrade(actual: number, target: number): { letter: string; color: string } {
  if (!target || !actual) return { letter: '—', color: 'text-zinc-500' }
  const ratio = actual / target
  if (ratio >= 1.5) return { letter: 'A', color: 'text-emerald-400' }
  if (ratio >= 1.2) return { letter: 'B', color: 'text-blue-400' }
  if (ratio >= 1.0) return { letter: 'C', color: 'text-amber-400' }
  if (ratio >= 0.75) return { letter: 'D', color: 'text-orange-400' }
  return { letter: 'F', color: 'text-red-400' }
}

// Week-over-week change
export function wowChange(current: number, previous: number): { value: number; label: string; positive: boolean } {
  if (!previous) return { value: 0, label: '—', positive: true }
  const change = ((current - previous) / previous) * 100
  return {
    value: change,
    label: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`,
    positive: change >= 0
  }
}

// For CPL, lower is better (invert positive)
export function wowChangeCPL(current: number, previous: number): { value: number; label: string; positive: boolean } {
  const w = wowChange(current, previous)
  return { ...w, positive: w.value <= 0 }
}

export function isEcomActionType(pat: string | null): boolean {
  return ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_web_purchase'].includes(pat || '')
}
