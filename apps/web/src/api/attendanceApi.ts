import { apiDownload, apiRequest } from './client'
import { getToken } from '@/lib/auth'

export type AttendanceStatus = 'ON_DUTY' | 'COMPLETED'

export type AttendanceRecord = {
  id: number
  userId: number | null
  clockManaged: boolean
  workDate: string
  workerFullName: string
  checkInTime: string
  checkOutTime: string | null
  lastActivityTime: string
  checkInLatitude: number | null
  checkInLongitude: number | null
  checkInAccuracy: number | null
  checkOutLatitude: number | null
  checkOutLongitude: number | null
  checkOutAccuracy: number | null
  workedHours: number | null
  status: AttendanceStatus
  reportCount: number
  firstWorkLogId: number | null
  completionPercent: number | null
  extraValues: Record<string, unknown> | null
  late: boolean
  lateThreshold: string
  lateExplanation: string | null
  createdAt: string
  updatedAt: string
}

export interface MyWorkDay {
  today: string
  serverTime: string
  current: AttendanceRecord | null
  recent: AttendanceRecord[]
  fieldSession: { sectionCode: string; status: 'OPEN' | 'RETURNED' } | null
}

export type AttendanceLocation = { latitude: number; longitude: number; accuracy: number }

export const fetchMyWorkDay = () => apiRequest<MyWorkDay>('/attendance/me')
export const startMyWorkDay = (location: AttendanceLocation) =>
  apiRequest<AttendanceRecord>('/attendance/me/start', { method: 'POST', body: JSON.stringify(location) })
export const finishMyWorkDay = (id: number, location: AttendanceLocation) =>
  apiRequest<AttendanceRecord>(`/attendance/me/${id}/finish`, { method: 'POST', body: JSON.stringify(location) })
export const saveLateExplanation = (id: number, explanation: string) =>
  apiRequest<AttendanceRecord>(`/attendance/me/${id}/explanation`, { method: 'POST', body: JSON.stringify({ explanation }) })

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  ON_DUTY: 'На работе',
  COMPLETED: 'Завершено',
}

export async function downloadAttendance(
  format: 'xlsx' | 'docx',
  query: { dateFrom: string; dateTo: string; workerFullName?: string },
): Promise<void> {
  const params = new URLSearchParams({ dateFrom: query.dateFrom, dateTo: query.dateTo })
  if (query.workerFullName?.trim()) params.set('workerFullName', query.workerFullName.trim())
  const token = getToken()
  const blob = await apiDownload(`/attendance/export.${format}?${params}`)
  if (getToken() !== token) throw new Error('Аккаунт изменился. Повторите скачивание.')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `tabel_gp-work_${query.dateFrom}_${query.dateTo}.${format}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Keep the URL alive until mobile browsers have started reading the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function fetchAttendance(query?: {
  dateFrom?: string
  dateTo?: string
  workerFullName?: string
}): Promise<AttendanceRecord[]> {
  const params = new URLSearchParams()
  if (query?.dateFrom) params.set('dateFrom', query.dateFrom)
  if (query?.dateTo) params.set('dateTo', query.dateTo)
  if (query?.workerFullName) params.set('workerFullName', query.workerFullName)
  const qs = params.toString()
  return apiRequest<AttendanceRecord[]>(`/attendance${qs ? `?${qs}` : ''}`)
}
