import { BadRequestException } from '@nestjs/common';
import { ExecutionStatus } from '../../common/enums/field-execution.enums';

const TRANSITIONS: Record<ExecutionStatus, ExecutionStatus[]> = {
  [ExecutionStatus.ASSIGNED]: [ExecutionStatus.EN_ROUTE, ExecutionStatus.ARRIVED],
  [ExecutionStatus.EN_ROUTE]: [ExecutionStatus.ARRIVED],
  [ExecutionStatus.ARRIVED]: [ExecutionStatus.STARTED],
  [ExecutionStatus.STARTED]: [ExecutionStatus.IN_PROGRESS, ExecutionStatus.COMPLETED],
  [ExecutionStatus.IN_PROGRESS]: [ExecutionStatus.COMPLETED],
  [ExecutionStatus.COMPLETED]: [ExecutionStatus.ACCEPTED, ExecutionStatus.REJECTED],
  [ExecutionStatus.ACCEPTED]: [],
  [ExecutionStatus.REJECTED]: [ExecutionStatus.STARTED, ExecutionStatus.IN_PROGRESS],
};

export function canTransition(from: ExecutionStatus, to: ExecutionStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ExecutionStatus, to: ExecutionStatus): void {
  if (!canTransition(from, to)) {
    throw new BadRequestException(`Недопустимый переход статуса: ${from} → ${to}`);
  }
}

export function distanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const dLat = toRad(latitudeB - latitudeA);
  const dLon = toRad(longitudeB - longitudeA);
  const latA = toRad(latitudeA);
  const latB = toRad(latitudeB);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function assertFreshLivenessEvidence(
  selfieUrl: string,
  evidenceUrls: string[],
  previouslyUsedUrls: string[] = [],
): void {
  if (evidenceUrls.length !== 3 || new Set(evidenceUrls).size !== 3) {
    throw new BadRequestException('Liveness требует три разных кадра');
  }
  if (!evidenceUrls.includes(selfieUrl)) {
    throw new BadRequestException('Основное селфи должно быть одним из трёх liveness-кадров');
  }
  const used = new Set(previouslyUsedUrls);
  if (evidenceUrls.some((url) => used.has(url))) {
    throw new BadRequestException('Для новой Face verification сделайте три новых кадра');
  }
}

// GPS is supporting evidence, not proof against a modified client. Never let a
// client-supplied accuracy expand the site's configured acceptance radius.
export const MAX_GPS_ACCURACY_METERS = 50;

export function assertInsideGeofence(
  section: { latitude: number | null; longitude: number | null; radiusMeters: number | null },
  latitude: number,
  longitude: number,
  accuracy?: number | null,
): number {
  if (section.latitude == null || section.longitude == null) {
    throw new BadRequestException('У участка не настроена геозона. Обратитесь к руководителю');
  }
  if (accuracy == null || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > MAX_GPS_ACCURACY_METERS) {
    throw new BadRequestException('Нужна точная геолокация: погрешность не более 50 м. Выйдите на открытое место и повторите');
  }
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
    throw new BadRequestException('Некорректные координаты');
  }
  const distance = distanceMeters(latitude, longitude, section.latitude, section.longitude);
  if (distance > (section.radiusMeters ?? 150)) {
    throw new BadRequestException(`Вы вне геозоны участка (${Math.round(distance)} м). Подойдите ближе и повторите`);
  }
  return distance;
}
