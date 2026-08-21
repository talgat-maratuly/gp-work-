import { apiRequest } from './client'

export type AttendanceStatus = 'ON_DUTY' | 'COMPLETED'

export type ActiveWorker = {
  id: number
  workerFullName: string
  checkInTime: string
}

export type AttendanceRecord = {
  id: number
  workDate: string
  workerFullName: string
  checkInTime: string
  checkOutTime: string | null
  lastActivityTime: string
  checkInLatitude: number | null
  checkInLongitude: number | null
  checkOutLatitude: number | null
  checkOutLongitude: number | null
  workedHours: number | null
  status: AttendanceStatus
  reportCount: number
  firstWorkLogId: number | null
  createdAt: string
  updatedAt: string
}

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  ON_DUTY: 'На работе',
  COMPLETED: 'Завершено',
}

export async function fetchActiveWorkersToday(): Promise<ActiveWorker[]> {
  return apiRequest<ActiveWorker[]>('/attendance/active-today')
}

export async function checkOut(payload: {
  attendanceId?: number
  workerFullName?: string
  latitude?: number
  longitude?: number
  locationAccuracy?: number
  locationAllowed?: boolean
}): Promise<AttendanceRecord> {
  return apiRequest<AttendanceRecord>('/attendance/check-out', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
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
