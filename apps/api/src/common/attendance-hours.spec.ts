import { calcWorkedHours } from './attendance-hours';

describe('Attendance excludes lunch only where the marks overlap 13:00–14:00', () => {
  it.each([
    ['09:00', '18:00', 8], ['09:00', '13:00', 4], ['14:00', '18:00', 4],
    ['13:00', '14:00', 0], ['13:15', '13:45', 0], ['12:30', '13:30', 0.5],
    ['13:30', '14:30', 0.5], ['12:30', '14:30', 1], ['14:00', '14:00', 0],
  ])('%s to %s = %s hours', (start, end, hours) => {
    expect(calcWorkedHours(new Date(`2026-10-02T${start}:00+05:00`), new Date(`2026-10-02T${end}:00+05:00`), '+05:00')).toBe(hours);
  });
  it('keeps night shifts and subtracts each intersected lunch once for multi-day shifts', () => {
    const start = new Date('2026-10-01T18:00:00+05:00');
    expect(calcWorkedHours(start, new Date('2026-10-02T06:00:00+05:00'), '+05:00')).toBe(12);
    expect(calcWorkedHours(new Date('2026-10-01T09:00:00+05:00'), new Date('2026-10-02T18:00:00+05:00'), '+05:00')).toBe(31);
    expect(calcWorkedHours(new Date('2026-10-01T13:30:00+05:00'), new Date('2026-10-02T13:30:00+05:00'), '+05:00')).toBe(23);
  });
  it('uses business time rather than server/device time and rounds only the final hours', () => {
    expect(calcWorkedHours(new Date('2026-10-02T12:30:00Z'), new Date('2026-10-02T14:30:00Z'), '+05:00')).toBe(2);
    expect(calcWorkedHours(new Date('2026-10-02T16:00:00Z'), new Date('2026-10-02T19:00:00Z'), '-05:00')).toBe(2);
    expect(calcWorkedHours(new Date('2026-10-02T12:59:00+05:00'), new Date('2026-10-02T14:01:00+05:00'), '+05:00')).toBe(0.03);
  });
});
