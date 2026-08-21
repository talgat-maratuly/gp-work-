import { apiRequest } from './client'
import { mapWorkLog, type ApiWorkLog } from './mappers'
import type { WorkLog, WorkLogFilters } from '@/lib/types'

function toQuery(filters: WorkLogFilters = {}): string {
  const params = new URLSearchParams()
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.workerName) params.set('workerFullName', filters.workerName)
  if (filters.objectId) params.set('objectId', String(filters.objectId))
  if (filters.sectionId) params.set('sectionId', String(filters.sectionId))
  if (filters.workTypeId) params.set('workTypeId', String(filters.workTypeId))
  const q = params.toString()
  return q ? `?${q}` : ''
}

export async function fetchWorkLogs(filters: WorkLogFilters = {}): Promise<WorkLog[]> {
  const data = await apiRequest<ApiWorkLog[]>(`/work-logs${toQuery(filters)}`)
  return data.map(mapWorkLog)
}

export async function createWorkLog(payload: {
  sectionId: number
  workerFullName: string
  workTypeId?: number
  taskId?: number
  customWorkType?: string | null
  workVolume: string
  comment?: string
  photoUrls: string[]
  latitude?: number | null
  longitude?: number | null
  locationAccuracy?: number | null
  locationAllowed?: boolean
}): Promise<WorkLog> {
  const data = await apiRequest<ApiWorkLog>('/work-logs', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return mapWorkLog(data)
}

export async function deleteWorkLog(id: number): Promise<void> {
  await apiRequest(`/work-logs/${id}`, { method: 'DELETE' })
}

export async function reviewWorkLog(
  id: number,
  payload: { reviewStatus: 'APPROVED' | 'REJECTED'; reviewComment?: string }
): Promise<WorkLog> {
  const data = await apiRequest<ApiWorkLog>(`/work-logs/${id}/review`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return mapWorkLog(data)
}

export const REVIEW_STATUS_LABELS = {
  PENDING: 'Ожидает проверки',
  APPROVED: 'Подтверждено',
  REJECTED: 'Отклонено',
} as const

export type WorkLogStats = {
  today: number
  week: number
  month: number
  recent: WorkLog[]
  topWorkers: { name: string; count: number }[]
  staleSections: {
    id: number
    name: string
    code: string
    objectName: string
    lastWork: string | null
  }[]
}

export async function fetchWorkLogStats(): Promise<WorkLogStats> {
  const data = await apiRequest<{
    today: number
    week: number
    month: number
    recent: ApiWorkLog[]
    topWorkers: { name: string; count: number }[]
    staleSections: WorkLogStats['staleSections']
  }>('/work-logs/stats')

  return {
    ...data,
    recent: data.recent.map(mapWorkLog),
  }
}
