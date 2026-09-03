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
