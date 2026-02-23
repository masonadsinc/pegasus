import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

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

const statusColors = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
}

export function statusDot(status: 'green' | 'yellow' | 'red'): string {
  return statusColors[status]
}
