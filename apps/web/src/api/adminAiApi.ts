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

export type WorkerAiBrief = {
  date: string
  worker: { id: number; fullName: string; role: string }
  workDay: {
    id: number
    status: string
    startedAt: string
    objectName: string
    sectionName: string
    sectionCode: string
  } | null
  metrics: { total: number; active: number; problems: number }
  tasks: {
    id: number
    title: string
    dueDate: string | null
    objectName: string
    sectionName: string
    sectionCode: string
    status: string
    nextAction: string
  }[]
  recommendations: string[]
  summary: string
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

export async function fetchWorkerAiBrief(): Promise<WorkerAiBrief> {
  return apiRequest<WorkerAiBrief>('/admin-ai/worker/brief')
}

export async function askWorkerAi(question: string): Promise<{ answer: string }> {
  return apiRequest<{ answer: string }>('/admin-ai/worker/question', {
    method: 'POST',
    body: JSON.stringify({ question }),
  })
}
