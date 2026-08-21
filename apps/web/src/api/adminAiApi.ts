import { apiRequest } from './client'

export type AdminAiRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export type AdminAiSummary = {
  date: string
  completedWorksToday: number
  employeesCheckedInToday: number
  employeesWithoutCheckout: string[]
  overdueTasks: number
  staleSections: {
    id: number
    code: string
    name: string
    objectName: string
    lastWork: string | null
  }[]
  lowStockProducts: {
    id: number
    name: string
    article: string | null
    currentQuantity: number
    unit: string | null
  }[]
  reportsPendingReview: number
  summary: string
  recommendations: string[]
}

export type AdminAiRisk = {
  level: AdminAiRiskLevel
  title: string
  description: string
  recommendation: string
  source: string
}

export const ADMIN_AI_RISK_LABELS: Record<AdminAiRiskLevel, string> = {
  LOW: 'Низкий риск',
  MEDIUM: 'Средний риск',
  HIGH: 'Высокий риск',
  URGENT: 'Срочно',
}

export async function fetchAdminAiSummary(): Promise<AdminAiSummary> {
  return apiRequest<AdminAiSummary>('/admin-ai/summary')
}

export async function fetchAdminAiRisks(): Promise<AdminAiRisk[]> {
  return apiRequest<AdminAiRisk[]>('/admin-ai/risks')
}

export async function askAdminAi(question: string): Promise<{ answer: string }> {
  return apiRequest<{ answer: string }>('/admin-ai/question', {
    method: 'POST',
    body: JSON.stringify({ question }),
  })
}
