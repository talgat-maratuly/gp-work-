import { apiRequest } from './client'

export type WateringShift = 'DAY' | 'NIGHT'
export type WateringType = 'AUTO' | 'WATER_CARRIER'
export type WateringStatus =
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'SKIPPED'
  | 'NEEDS_REVIEW'

export const WATERING_SHIFT_LABELS: Record<WateringShift, string> = {
  DAY: 'День',
  NIGHT: 'Ночь',
}

export const WATERING_TYPE_LABELS: Record<WateringType, string> = {
  AUTO: 'Автоматический',
  WATER_CARRIER: 'Водовоз',
}

export const WATERING_STATUS_LABELS: Record<WateringStatus, string> = {
  PLANNED: 'Запланировано',
  IN_PROGRESS: 'В процессе',
  DONE: 'Полито',
  SKIPPED: 'Пропущено',
  NEEDS_REVIEW: 'Требует проверки',
}

interface UserRef {
  id: number
  fullName: string
  role: string
}

export interface WateringRecord {
  id: number
  workDate: string
  shift: WateringShift
  type: WateringType
  objectId: number | null
  sectionId: number | null
  waterCarrierId: number | null
  performerName: string | null
  plannedLiters: number | null
  actualLiters: number | null
  litersDiff: number | null
  startTime: string | null
  endTime: string | null
  comment: string | null
  photoUrls: string[]
  latitude: number | null
  longitude: number | null
  qrConfirmed: boolean
  status: WateringStatus
  createdById: number | null
  reviewedById: number | null
  reviewedAt: string | null
  reviewComment: string | null
  createdAt: string
  updatedAt: string
  objectName: string | null
  sectionName: string | null
  sectionCode: string | null
  object: { id: number; name: string } | null
  section: { id: number; name: string; code: string } | null
  waterCarrier: UserRef | null
  createdBy: UserRef | null
  reviewedBy: UserRef | null
}

export interface WateringStats {
  total: number
  planned: number
  inProgress: number
  done: number
  skipped: number
  needsReview: number
  plannedLiters: number
  actualLiters: number
  litersDiff: number
  objectsWithoutConfirmed: number
  waterCarrierCount: number
}

export interface WateringFilters {
  date?: string
  dateFrom?: string
  dateTo?: string
  shift?: WateringShift | ''
  type?: WateringType | ''
  status?: WateringStatus | ''
  waterCarrierId?: number | ''
  objectId?: number | ''
  sectionId?: number | ''
  search?: string
}

export interface WateringPayload {
  workDate: string
  shift: WateringShift
  type: WateringType
  objectId?: number | null
  sectionId?: number | null
  waterCarrierId?: number | null
  performerName?: string
  plannedLiters?: number | null
  actualLiters?: number | null
  startTime?: string
  endTime?: string
  comment?: string
  photoUrls?: string[]
  latitude?: number | null
  longitude?: number | null
  qrConfirmed?: boolean
  status?: WateringStatus
}

function buildQuery(filters: WateringFilters = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function fetchWatering(filters: WateringFilters = {}): Promise<WateringRecord[]> {
  return apiRequest<WateringRecord[]>(`/watering${buildQuery(filters)}`)
}

export function fetchWateringStats(filters: WateringFilters = {}): Promise<WateringStats> {
  return apiRequest<WateringStats>(`/watering/stats${buildQuery(filters)}`)
}

export function createWatering(payload: WateringPayload): Promise<WateringRecord> {
  return apiRequest<WateringRecord>('/watering', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateWatering(
  id: number,
  payload: Partial<WateringPayload>,
): Promise<WateringRecord> {
  return apiRequest<WateringRecord>(`/watering/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function reviewWatering(
  id: number,
  payload: { status: WateringStatus; reviewComment?: string },
): Promise<WateringRecord> {
  return apiRequest<WateringRecord>(`/watering/${id}/review`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteWatering(id: number): Promise<void> {
  return apiRequest<void>(`/watering/${id}`, { method: 'DELETE' })
}
