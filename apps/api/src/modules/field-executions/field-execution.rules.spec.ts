import { BadRequestException } from '@nestjs/common';
import { ExecutionStatus } from '../../common/enums/field-execution.enums';
import { assertFreshLivenessEvidence, assertTransition, canTransition, distanceMeters } from './field-execution.rules';

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
