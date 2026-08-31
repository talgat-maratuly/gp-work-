import { apiRequest } from './client'

export type AdminReportStatus =
  | 'DRAFT'
  | 'FORMED'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'RETURNED'

export const ADMIN_REPORT_STATUS_LABELS: Record<AdminReportStatus, string> = {
  DRAFT: 'Черновик',
  FORMED: 'Сформирован',
  IN_REVIEW: 'На проверке',
  APPROVED: 'Подтверждён',
  RETURNED: 'Возвращён на доработку',
}

interface UserRef {
  id: number
  fullName: string
  role: string
}

export interface AdminReportHistoryEntry {
  status: AdminReportStatus
  byId: number | null
  byName: string | null
  at: string
  comment?: string | null
}

export interface AdminReport {
  id: number
  reportDate: string
  authorId: number | null
  completedWorks: string | null
  pendingWorks: string | null
  tasksInProgress: string | null
  overdueTasks: string | null
  wateringDone: string | null
  plannedLiters: number | null
  actualLiters: number | null
  issues: string | null
  attentionObjects: string | null
  brigadesInfo: string | null
  waterCarriersInfo: string | null
  decisions: string | null
  comment: string | null
  photoUrls: string[]
  status: AdminReportStatus
  statusHistory: AdminReportHistoryEntry[]
  reviewedById: number | null
  reviewedAt: string | null
  reviewComment: string | null
  createdAt: string
  updatedAt: string
  author: UserRef | null
  reviewedBy: UserRef | null
}

export interface AdminReportAggregate {
  date: string
  tasksToday: number
  closed: number
  inProgress: number
  needsReview: number
  overdue: number
  attendanceCount: number
  watering: {
    total: number
    done: number
    needsReview: number
    plannedLiters: number
    actualLiters: number
    litersDiff: number
  }
}

export interface AdminReportFilters {
  dateFrom?: string
  dateTo?: string
  authorId?: number | ''
  status?: AdminReportStatus | ''
}

export interface AdminReportPayload {
  reportDate: string
  completedWorks?: string
  pendingWorks?: string
  tasksInProgress?: string
  overdueTasks?: string
  wateringDone?: string
  plannedLiters?: number | null
  actualLiters?: number | null
  issues?: string
  attentionObjects?: string
  brigadesInfo?: string
  waterCarriersInfo?: string
  decisions?: string
  comment?: string
  photoUrls?: string[]
}

function buildQuery(filters: AdminReportFilters = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function fetchAdminReports(filters: AdminReportFilters = {}): Promise<AdminReport[]> {
  return apiRequest<AdminReport[]>(`/admin-reports${buildQuery(filters)}`)
}

export function fetchAdminReport(id: number): Promise<AdminReport> {
  return apiRequest<AdminReport>(`/admin-reports/${id}`)
}

export function fetchReportAggregate(date: string): Promise<AdminReportAggregate> {
  return apiRequest<AdminReportAggregate>(
    `/admin-reports/aggregate?date=${encodeURIComponent(date)}`,
  )
}

export function createAdminReport(payload: AdminReportPayload): Promise<AdminReport> {
  return apiRequest<AdminReport>('/admin-reports', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateAdminReport(
  id: number,
  payload: Partial<AdminReportPayload>,
): Promise<AdminReport> {
  return apiRequest<AdminReport>(`/admin-reports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function submitAdminReport(id: number): Promise<AdminReport> {
  return apiRequest<AdminReport>(`/admin-reports/${id}/submit`, { method: 'POST' })
}

export function reviewAdminReport(
  id: number,
  payload: { status: 'APPROVED' | 'RETURNED'; reviewComment?: string },
): Promise<AdminReport> {
  return apiRequest<AdminReport>(`/admin-reports/${id}/review`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteAdminReport(id: number): Promise<void> {
  return apiRequest<void>(`/admin-reports/${id}`, { method: 'DELETE' })
}
