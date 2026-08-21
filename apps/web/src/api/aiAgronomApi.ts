import { apiRequest } from './client'

export type AiPlantStatus = 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'BAD' | 'CRITICAL'

export type AiAgronomAnalysis = {
  id: number
  createdById: number | null
  objectId: number
  sectionId: number | null
  culture: string | null
  photoUrl: string
  status: AiPlantStatus
  confidence: number
  healthPercent: number
  droughtSigns: boolean
  burnSigns: boolean
  weedsPresent: boolean
  diseaseSigns: boolean
  pestSigns: boolean
  yellowingLeaves: boolean
  nutritionDeficiency: boolean
  mechanicalDamage: boolean
  fireDamage: boolean
  severeDrying: boolean
  massDieOff: boolean
  growthStage: string | null
  aiComment: string
  recommendations: string[]
  agronomistComment: string | null
  modelName: string | null
  createdAt: string
  createdBy: { id: number; fullName: string } | null
  object: { id: number; name: string } | null
  section: { id: number; name: string; code: string; culture: string | null } | null
}

export type AiAgronomStats = {
  total: number
  healthy: number
  attention: number
  problem: number
  problemObjects: { objectName: string; count: number }[]
}

export const AI_STATUS_LABELS: Record<AiPlantStatus, string> = {
  EXCELLENT: '🟢 Отличное',
  GOOD: '🟢 Хорошее',
  AVERAGE: '🟡 Среднее',
  BAD: '🔴 Плохое',
  CRITICAL: '🔴 Критическое',
}

export async function createAiAnalysis(payload: {
  objectId: number
  sectionId?: number
  culture?: string
  photoUrl: string
  agronomistComment?: string
}): Promise<AiAgronomAnalysis> {
  return apiRequest<AiAgronomAnalysis>('/ai-agronom/analyses', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchAiAnalyses(): Promise<AiAgronomAnalysis[]> {
  return apiRequest<AiAgronomAnalysis[]>('/ai-agronom/analyses')
}

export async function fetchAiAgronomStats(): Promise<AiAgronomStats> {
  return apiRequest<AiAgronomStats>('/ai-agronom/stats')
}
