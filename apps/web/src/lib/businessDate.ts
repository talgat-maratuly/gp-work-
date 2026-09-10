const BUSINESS_TIME_ZONE = import.meta.env.VITE_BUSINESS_TIME_ZONE || 'Asia/Oral'

export function businessDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function businessMonthString(date = new Date()): string {
  return businessDateString(date).slice(0, 7)
}
