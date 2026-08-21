import { apiDownload } from './client'
import type { WorkLogFilters } from '@/lib/types'

function toQuery(filters: WorkLogFilters, dateFrom: string, dateTo: string): string {
  const params = new URLSearchParams()
  params.set('dateFrom', dateFrom)
  params.set('dateTo', dateTo)
  if (filters.workerName) params.set('workerFullName', filters.workerName)
  if (filters.objectId) params.set('objectId', String(filters.objectId))
  if (filters.sectionId) params.set('sectionId', String(filters.sectionId))
  if (filters.workTypeId) params.set('workTypeId', String(filters.workTypeId))
  return params.toString()
}

export async function downloadWorkLogsExcel(
  filters: WorkLogFilters,
  dateFrom: string,
  dateTo: string
): Promise<void> {
  const blob = await apiDownload(`/export/work-logs.xlsx?${toQuery(filters, dateFrom, dateTo)}`)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `otchet_rabot_gp-work_${dateFrom}_${dateTo}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
