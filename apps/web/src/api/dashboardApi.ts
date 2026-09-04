import { apiRequest } from './client'

export interface DashboardSummary {
  filters: {
    date: string
    period: string
    objectId: number | null
    brigadeId: number | null
    shift: 'DAY' | 'NIGHT' | null
  }
  cards: {
    objectsTotal: number
    totalAreaM2: number
    tasksToday: number
    tasksDone: number
    tasksInProgress: number
    tasksOverdue: number
    tasksNeedsReview: number
    wateringPlannedLiters: number
    wateringActualLiters: number
    waterCarriers: number
    activeBrigades: number
    workCompletionPercent: number
    reviewPassPercent: number
    objectsWithoutConfirmedWatering: number
  }
  tasksTodayList: {
    id: number
    description: string
    objectName: string
    assigneeName: string | null
    status: string
  }[]
  nightWatering: {
    polito: number
    notPolito: number
    needsReview: number
    liters: number
  }
  productionPlan: {
    total: number
    planned: number
    inProgress: number
    done: number
  }
  kpi: {
    qaPass: number
    wateringExec: number
    scheduleExec: number
    decisionsExec: number
    tasksWithPhoto: number
  }
  executionReview: {
    taskId: number
    description: string
    objectName: string
    workTypeName: string | null
    assigneeName: string | null
    status: string
    photoCount: number
  }[]
  qualityExceptions: { type: string; title: string; detail: string }[]
  protocols: {
    id: number
    title: string
    status: string
    dueDate: string | null
    responsible: string | null
  }[]
}

export interface DashboardParams {
  date?: string
  period?: 'day' | 'week' | 'month'
  objectId?: number | ''
  brigadeId?: number | ''
  shift?: 'DAY' | 'NIGHT' | ''
}

export function fetchDashboardSummary(params: DashboardParams = {}): Promise<DashboardSummary> {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    q.set(k, String(v))
  }
  const qs = q.toString()
  return apiRequest<DashboardSummary>(`/dashboard/summary${qs ? `?${qs}` : ''}`)
}
