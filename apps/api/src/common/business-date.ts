export function businessDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.BUSINESS_TIME_ZONE || 'Asia/Oral',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function businessDayUtcRange(date = new Date()): { start: Date; end: Date } {
  const day = businessDateString(date);
  const offset = process.env.BUSINESS_UTC_OFFSET || '+05:00';
  return {
    start: new Date(`${day}T00:00:00.000${offset}`),
    end: new Date(`${day}T23:59:59.999${offset}`),
  };
}

export type BusinessPeriod = 'day' | 'week' | 'month';

function parseCalendarDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Date must use YYYY-MM-DD format');
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error('Date does not exist');
  }
  return parsed;
}

function utcDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function businessPeriodRange(
  period: BusinessPeriod,
  anchor = businessDateString(),
): { from: string; to: string } {
  const date = parseCalendarDate(anchor);

  if (period === 'day') return { from: anchor, to: anchor };

  if (period === 'week') {
    const mondayOffset = (date.getUTCDay() + 6) % 7;
    const from = new Date(date);
    from.setUTCDate(from.getUTCDate() - mondayOffset);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 6);
    return { from: utcDateString(from), to: utcDateString(to) };
  }

  const from = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const to = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return { from: utcDateString(from), to: utcDateString(to) };
}
