import { durationMinutes, isCompletedOnTime, percent, periodDates } from './operations.metrics';

describe('operations evidence metrics', () => {
  it('resolves monday-to-sunday reporting week', () => {
    expect(periodDates('2026-09-03', 'week')).toEqual({ dateFrom: '2026-08-31', dateTo: '2026-09-06' });
  });

  it('calculates percentages without division errors', () => {
    expect(percent(3, 4)).toBe(75);
    expect(percent(0, 0)).toBe(0);
  });

  it('calculates evidence duration', () => {
    expect(durationMinutes(new Date('2026-09-03T10:00:00Z'), new Date('2026-09-03T11:31:00Z'))).toBe(91);
  });

  it('uses the business-day end for on-time completion', () => {
    expect(isCompletedOnTime(new Date('2026-09-03T18:30:00Z'), '2026-09-03')).toBe(true);
    expect(isCompletedOnTime(new Date('2026-09-03T19:30:00Z'), '2026-09-03')).toBe(false);
  });
});
