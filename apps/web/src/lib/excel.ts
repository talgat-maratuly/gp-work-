import { downloadWorkLogsExcel } from '@/api/exportApi'
import type { WorkLogFilters } from './types'

/** @deprecated logs argument ignored — export uses server filters */
export async function exportWorkLogsToExcel(
  _logs: unknown[],
  dateFrom: string,
  dateTo: string,
  filters: WorkLogFilters = {}
): Promise<void> {
  await downloadWorkLogsExcel(filters, dateFrom, dateTo)
}
