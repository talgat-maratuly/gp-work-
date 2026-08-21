import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns'
import type { QuickFilterId } from './constants'

export function toDateInput(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

export function quickFilterRange(id: QuickFilterId): { from: string; to: string } {
  const now = new Date()
  switch (id) {
    case 'today':
      return { from: toDateInput(startOfDay(now)), to: toDateInput(endOfDay(now)) }
    case 'yesterday': {
      const y = subDays(now, 1)
      return { from: toDateInput(startOfDay(y)), to: toDateInput(endOfDay(y)) }
    }
    case 'week':
      return {
        from: toDateInput(startOfWeek(now, { weekStartsOn: 1 })),
        to: toDateInput(endOfWeek(now, { weekStartsOn: 1 })),
      }
    case 'month':
      return {
        from: toDateInput(startOfMonth(now)),
        to: toDateInput(endOfMonth(now)),
      }
  }
}

export function formatSubmittedDate(iso: string): string {
  return format(new Date(iso), 'dd.MM.yyyy')
}

export function formatSubmittedTime(iso: string): string {
  return format(new Date(iso), 'HH:mm')
}
