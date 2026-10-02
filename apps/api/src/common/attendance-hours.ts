const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Net time between marks, excluding each local 13:00–14:00 lunch window.
 * Uses the same fixed business UTC offset as businessDayUtcRange.
 */
export function calcWorkedHours(checkIn: Date, checkOut: Date, utcOffset = process.env.BUSINESS_UTC_OFFSET || '+05:00'): number {
  const start = checkIn.getTime(), end = checkOut.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new RangeError('Invalid attendance timestamp');
  if (end <= start) return 0;
  const parts = /^([+-])(\d{2}):([0-5]\d)$/.exec(utcOffset);
  if (!parts || Number(parts[2]) > 23) throw new RangeError('Invalid business UTC offset');
  const offset = (Number(parts[2]) * 60 + Number(parts[3])) * 60_000 * (parts[1] === '-' ? -1 : 1);
  // Cumulative lunch milliseconds: whole calendar days plus overlap on the last day.
  // Subtracting two values handles overnight/multi-day records without a loop.
  const lunchBefore = (timestamp: number) => {
    const local = timestamp + offset;
    const day = Math.floor(local / DAY);
    return day * HOUR + Math.min(HOUR, Math.max(0, local - day * DAY - 13 * HOUR));
  };
  const worked = end - start - (lunchBefore(end) - lunchBefore(start));
  return Math.max(0, Math.round(worked / HOUR * 100) / 100);
}
