import { addDays, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';

export type ReportPeriod = 'day' | 'week' | 'month';

export function periodDates(anchor: string, period: ReportPeriod): { dateFrom: string; dateTo: string } {
  const date = parseISO(anchor);
  if (Number.isNaN(date.getTime())) throw new Error('Некорректная дата');
  if (period === 'week') {
    return {
      dateFrom: format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      dateTo: format(endOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    };
  }
  if (period === 'month') {
    return { dateFrom: format(startOfMonth(date), 'yyyy-MM-dd'), dateTo: format(endOfMonth(date), 'yyyy-MM-dd') };
  }
  return { dateFrom: anchor, dateTo: anchor };
}

export function evidenceRange(dateFrom: string, dateTo: string, utcOffset = '+05:00') {
  return {
    from: new Date(`${dateFrom}T00:00:00.000${utcOffset}`),
    to: new Date(`${format(addDays(parseISO(dateTo), 1), 'yyyy-MM-dd')}T00:00:00.000${utcOffset}`),
  };
}

export function percent(part: number, total: number): number {
  return total ? Math.round((part / total) * 1000) / 10 : 0;
}

export function durationMinutes(startedAt: Date | null, completedAt: Date | null): number | null {
  if (!startedAt || !completedAt) return null;
  return Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 60_000));
}

export function isCompletedOnTime(completedAt: Date | null, dueDate: string | null, utcOffset = '+05:00') {
  if (!completedAt || !dueDate) return null;
  return completedAt <= new Date(`${dueDate}T23:59:59.999${utcOffset}`);
}
