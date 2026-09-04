import { apiRequest } from './client'

export type AttendanceStatus = 'ON_DUTY' | 'COMPLETED'

export type AttendanceRecord = {
  id: number
  userId: number | null
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
