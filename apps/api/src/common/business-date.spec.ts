import { businessDateString, businessDayUtcRange } from './business-date';

describe('business date', () => {
  beforeEach(() => {
    process.env.BUSINESS_TIME_ZONE = 'Asia/Oral';
    process.env.BUSINESS_UTC_OFFSET = '+05:00';
  });

  it('uses the next Oral day after 19:00 UTC', () => {
    expect(businessDateString(new Date('2026-09-03T19:05:00.000Z'))).toBe('2026-09-04');
  });

  it('returns UTC boundaries for the Oral business day', () => {
    expect(businessDayUtcRange(new Date('2026-09-03T19:05:00.000Z'))).toEqual({
      start: new Date('2026-09-03T19:00:00.000Z'),
      end: new Date('2026-09-04T18:59:59.999Z'),
    });
  });
});
