import { BadRequestException } from '@nestjs/common';
import { ExecutionStatus } from '../../common/enums/field-execution.enums';
import { assertInsideGeofence, assertFreshLivenessEvidence, assertTransition, canTransition, distanceMeters } from './field-execution.rules';

describe('field execution rules', () => {
  it('allows the complete evidence lifecycle', () => {
    const path = [
      ExecutionStatus.ASSIGNED,
      ExecutionStatus.ARRIVED,
      ExecutionStatus.STARTED,
      ExecutionStatus.IN_PROGRESS,
      ExecutionStatus.COMPLETED,
      ExecutionStatus.ACCEPTED,
    ];
    for (let index = 1; index < path.length; index += 1) {
      expect(canTransition(path[index - 1], path[index])).toBe(true);
    }
  });

  it('does not allow accepting work before completion', () => {
    expect(() => assertTransition(ExecutionStatus.IN_PROGRESS, ExecutionStatus.ACCEPTED)).toThrow(
      BadRequestException,
    );
  });

  it('allows rejected work to be restarted', () => {
    expect(canTransition(ExecutionStatus.REJECTED, ExecutionStatus.STARTED)).toBe(true);
    expect(canTransition(ExecutionStatus.REJECTED, ExecutionStatus.IN_PROGRESS)).toBe(true);
  });

  it('calculates object radius distance in meters', () => {
    expect(distanceMeters(51.2333, 51.3667, 51.2333, 51.3667)).toBe(0);
    const distance = distanceMeters(51.2333, 51.3667, 51.2342, 51.3667);
    expect(distance).toBeGreaterThan(95);
    expect(distance).toBeLessThan(105);
  });

  it('accepts three fresh liveness frames containing the primary selfie', () => {
    expect(() => assertFreshLivenessEvidence('/a.jpg', ['/a.jpg', '/b.jpg', '/c.jpg'])).not.toThrow();
  });

  it('rejects a selfie outside the three liveness frames', () => {
    expect(() => assertFreshLivenessEvidence('/selfie.jpg', ['/a.jpg', '/b.jpg', '/c.jpg'])).toThrow(
      'Основное селфи должно быть одним из трёх liveness-кадров',
    );
  });

  it('rejects evidence reused from a previous verification', () => {
    expect(() => assertFreshLivenessEvidence('/a.jpg', ['/a.jpg', '/b.jpg', '/c.jpg'], ['/b.jpg'])).toThrow(
      'Для новой Face verification сделайте три новых кадра',
    );
  });
});

describe('mandatory bounded geofence', () => {
  const section = { latitude: 51.2301, longitude: 51.3701, radiusMeters: 150 };
  it('accepts a precise position inside the configured site', () => {
    expect(assertInsideGeofence(section, 51.2301, 51.3701, 5)).toBe(0);
  });
  it('rejects missing configuration and missing or unreliable accuracy', () => {
    expect(() => assertInsideGeofence({ ...section, latitude: null }, 51.2301, 51.3701, 5)).toThrow('не настроена геозона');
    for (const accuracy of [undefined, null, NaN, Infinity, -1, 51, 1_000_000]) {
      expect(() => assertInsideGeofence(section, 51.2301, 51.3701, accuracy)).toThrow('точная геолокация');
    }
  });
  it('does not expand the radius by the claimed accuracy', () => {
    // About 167m north: previously accepted with a 50m tolerance.
    expect(() => assertInsideGeofence(section, 51.2316, 51.3701, 50)).toThrow('вне геозоны');
    expect(() => assertInsideGeofence(section, NaN, 51.3701, 5)).toThrow('Некорректные координаты');
  });
});
