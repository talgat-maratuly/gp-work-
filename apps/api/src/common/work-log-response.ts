import { parsePhotoUrls } from './photo-urls';

export function withPhotoUrlsArray<T extends { photoUrls: unknown }>(
  log: T,
): T & { photoUrls: string[] } {
  return {
    ...log,
    photoUrls: parsePhotoUrls(log.photoUrls),
  };
}

export function mapWorkLogsWithPhotos<T extends { photoUrls: unknown }>(
  logs: T[],
): Array<T & { photoUrls: string[] }> {
  return logs.map(withPhotoUrlsArray);
}
