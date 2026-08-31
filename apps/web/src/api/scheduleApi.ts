import { apiRequest } from './client'

export type ScheduleStatus =
  | 'PLANNED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'NEEDS_REVIEW'
  | 'OVERDUE'
  | 'POSTPONED_RAIN'
  | 'POSTPONED_REASON'
  | 'CANCELLED'

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  PLANNED: 'Запланировано',
  ACCEPTED: 'Принято',
  IN_PROGRESS: 'В работе',
  DONE: 'Выполнено',
  NEEDS_REVIEW: 'Требует проверки',
  OVERDUE: 'Просрочено',
  POSTPONED_RAIN: 'Перенесено (дождь)',
  POSTPONED_REASON: 'Перенесено (причина)',
  CANCELLED: 'Отменено',
}

// Цвета статусов для ячеек календаря (фон + текст).
export const SCHEDULE_STATUS_COLORS: Record<ScheduleStatus, string> = {
  PLANNED: 'bg-amber-400 text-amber-950',
  ACCEPTED: 'bg-sky-400 text-sky-950',
  IN_PROGRESS: 'bg-blue-500 text-white',
  DONE: 'bg-emerald-500 text-white',
  NEEDS_REVIEW: 'bg-orange-400 text-orange-950',
  OVERDUE: 'bg-red-500 text-white',
  POSTPONED_RAIN: 'bg-violet-500 text-white',
  POSTPONED_REASON: 'bg-amber-600 text-white',
  CANCELLED: 'bg-slate-400 text-white',
}

export const SCHEDULE_STATUS_ORDER: ScheduleStatus[] = [
  'PLANNED',
  'ACCEPTED',
  'IN_PROGRESS',
  'DONE',
  'NEEDS_REVIEW',
  'OVERDUE',
  'POSTPONED_RAIN',
  'POSTPONED_REASON',
  'CANCELLED',
]

interface UserRef {
  id: number
  fullName: string
  role: string
}

export interface ScheduleHistoryEntry {
  status?: ScheduleStatus
  action: string
  byId: number | null
  byName: string | null
  at: string
  comment?: string | null
}

export interface ScheduleEntry {
  id: number
  plannedDate: string
  objectId: number | null
  sectionId: number | null
  workTypeId: number | null
  brigadeId: number | null
  assigneeUserId: number | null
  taskId: number | null
  status: ScheduleStatus
  rescheduleReason: string | null
  comment: string | null
  statusHistory: ScheduleHistoryEntry[]
  createdById: number | null
  createdAt: string
  updatedAt: string
  objectName: string | null
  sectionName: string | null
  sectionCode: string | null
  workTypeName: string | null
  brigadeName: string | null
  object: { id: number; name: string } | null
  workType: { id: number; name: string } | null
  brigade: { id: number; name: string } | null
  assignee: UserRef | null
  createdBy: UserRef | null
  task: {
    id: number
    status: string
    dueDate: string | null
    completedAt: string | null
    photoUrls: string[]
    photoCount: number
    latitude: number | null
    longitude: number | null
  } | null
  latitude: number | null
  longitude: number | null
}

export interface ScheduleFilters {
  month?: string
  dateFrom?: string
  dateTo?: string
  objectId?: number | ''
  brigadeId?: number | ''
  assigneeUserId?: number | ''
  workTypeId?: number | ''
  status?: ScheduleStatus | ''
}

export interface SchedulePayload {
  plannedDate: string
  objectId: number
  sectionId?: number | null
  workTypeId?: number | null
  brigadeId?: number | null
  assigneeUserId?: number | null
  taskId?: number | null
  status?: ScheduleStatus
  comment?: string
}

function buildQuery(filters: ScheduleFilters = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function fetchSchedule(filters: ScheduleFilters = {}): Promise<ScheduleEntry[]> {
  return apiRequest<ScheduleEntry[]>(`/schedule${buildQuery(filters)}`)
}

export function createSchedule(payload: SchedulePayload): Promise<ScheduleEntry> {
  return apiRequest<ScheduleEntry>('/schedule', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateSchedule(
  id: number,
  payload: Partial<SchedulePayload> & { rescheduleReason?: string },
): Promise<ScheduleEntry> {
  return apiRequest<ScheduleEntry>(`/schedule/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteSchedule(id: number): Promise<void> {
  return apiRequest<void>(`/schedule/${id}`, { method: 'DELETE' })
}
