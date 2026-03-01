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

/**
 * Get the best available creative URL for an ad.
 * Prefers stored (permanent Supabase) URL over Meta CDN URL.
 */
export function getCreativeUrl(ad: any): string | null {
  return ad?.stored_creative_url || ad?.creative_url || ad?.creative_thumbnail_url || null
}
