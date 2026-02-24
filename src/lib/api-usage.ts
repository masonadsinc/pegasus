import { supabaseAdmin } from './supabase'

const ORG_ID = process.env.ADSINC_ORG_ID!

// Gemini pricing (per 1M tokens) — approximate as of Feb 2026
const PRICING: Record<string, { input: number; output: number; image?: number }> = {
  'gemini-3-flash-preview': { input: 0.10, output: 0.40 },
  'gemini-3-pro-image-preview': { input: 1.25, output: 5.00, image: 0.04 },
  'gemini-2.5-pro': { input: 1.25, output: 5.00 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
}

export type ApiFeature =
  | 'pegasus-chat'
  | 'report-generation'
  | 'creative-analysis'
  | 'creative-studio-analysis'
  | 'creative-studio-generation'
  | 'creative-studio-qa'
  | 'creative-studio-summary'

export async function logApiUsage(params: {
  model: string
  feature: ApiFeature
  inputTokens?: number
  outputTokens?: number
  imagesGenerated?: number
  metadata?: Record<string, any>
}) {
  const pricing = PRICING[params.model] || { input: 0.10, output: 0.40 }
  const inputCost = ((params.inputTokens || 0) / 1_000_000) * pricing.input
  const outputCost = ((params.outputTokens || 0) / 1_000_000) * pricing.output
  const imageCost = (params.imagesGenerated || 0) * (pricing.image || 0)
  const totalCost = inputCost + outputCost + imageCost

  try {
    await supabaseAdmin.from('api_usage').insert({
      org_id: ORG_ID,
      provider: 'gemini',
      model: params.model,
      feature: params.feature,
      input_tokens: params.inputTokens || 0,
      output_tokens: params.outputTokens || 0,
      images_generated: params.imagesGenerated || 0,
      estimated_cost: totalCost,
      metadata: params.metadata || {},
    })
  } catch (e) {
    console.error('Failed to log API usage:', e)
  }
}

// Extract token counts from Gemini response metadata
export function extractTokenCounts(response: any): { inputTokens: number; outputTokens: number } {
  const usage = response?.usageMetadata || {}
  return {
    inputTokens: usage.promptTokenCount || 0,
    outputTokens: usage.candidatesTokenCount || usage.totalTokenCount || 0,
  }
}
