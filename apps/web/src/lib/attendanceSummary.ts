import type { AttendanceRecord } from '@/api/attendanceApi'

export function attendanceSummary(rows: Pick<AttendanceRecord, 'userId' | 'workerFullName' | 'status' | 'workedHours'>[]) {
  return {
    people: new Set(rows.map(row => row.userId != null ? `user:${row.userId}` : `legacy:${row.workerFullName.trim().toLocaleLowerCase('ru')}`)).size,
    open: rows.filter(row => row.status === 'ON_DUTY').length,
    completed: rows.filter(row => row.status === 'COMPLETED').length,
    hours: rows.reduce((total, row) => total + (row.status === 'COMPLETED' ? row.workedHours ?? 0 : 0), 0),
  }
}
