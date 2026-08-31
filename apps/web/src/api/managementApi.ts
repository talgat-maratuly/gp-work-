import { apiRequest } from './client'

export type DecisionStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'ROUTED_TO_TASK'
  | 'DONE'
  | 'CANCELLED'

export type DecisionPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export const DECISION_STATUS_LABELS: Record<DecisionStatus, string> = {
  OPEN: 'Открыто',
  IN_PROGRESS: 'В работе',
  ROUTED_TO_TASK: 'Переведено в задачу',
  DONE: 'Выполнено',
  CANCELLED: 'Отменено',
}

export const DECISION_PRIORITY_LABELS: Record<DecisionPriority, string> = {
  LOW: 'Низкий',
  MEDIUM: 'Средний',
  HIGH: 'Высокий',
}

interface UserRef {
  id: number
  fullName: string
  role: string
}

export interface DecisionHistoryEntry {
  status: DecisionStatus
  byId: number | null
  byName: string | null
  at: string
  comment?: string | null
}

export interface Decision {
  id: number
  title: string
  description: string | null
  responsibleUserId: number | null
  dueDate: string | null
  priority: DecisionPriority
  status: DecisionStatus
  comment: string | null
  linkedTaskId: number | null
  statusHistory: DecisionHistoryEntry[]
  createdById: number | null
  createdAt: string
  updatedAt: string
  responsible: UserRef | null
  createdBy: UserRef | null
}

export interface DecisionPayload {
  title: string
  description?: string
  responsibleUserId?: number | null
  dueDate?: string | null
  priority?: DecisionPriority
  status?: DecisionStatus
  comment?: string
  linkedTaskId?: number | null
}

export interface ManagementOverview {
  range: { from: string; to: string; period: string }
  dailyReport: {
    tasksTotal: number
    closed: number
    inProgress: number
    overdue: number
    needsReview: number
    objectsWithoutPhoto: number
    wateringWithoutActual: number
  }
  watering: {
    total: number
    done: number
    plannedLiters: number
    actualLiters: number
    litersDiff: number
  }
  schedule: { total: number; done: number }
  decisions: { total: number; done: number; overdue: number }
  kpi: {
    qaPass: number
    wateringExec: number
    scheduleExec: number
    decisionsExec: number
    tasksWithPhoto: number
  }
  qualityExceptions: { type: string; title: string; detail: string }[]
  executionReview: {
    taskId: number
    description: string
    objectName: string
    sectionName: string
    workTypeName: string | null
    assigneeName: string | null
    brigadeName: string | null
    status: string
    photoCount: number
    reviewComment: string | null
  }[]
}

export function fetchOverview(
  period: 'day' | 'week' | 'month' = 'day',
  date?: string,
): Promise<ManagementOverview> {
  const params = new URLSearchParams({ period })
  if (date) params.set('date', date)
  return apiRequest<ManagementOverview>(`/management/overview?${params.toString()}`)
}

export function fetchDecisions(): Promise<Decision[]> {
  return apiRequest<Decision[]>('/management/decisions')
}

export function createDecision(payload: DecisionPayload): Promise<Decision> {
  return apiRequest<Decision>('/management/decisions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateDecision(
  id: number,
  payload: Partial<DecisionPayload>,
): Promise<Decision> {
  return apiRequest<Decision>(`/management/decisions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteDecision(id: number): Promise<void> {
  return apiRequest<void>(`/management/decisions/${id}`, { method: 'DELETE' })
}
