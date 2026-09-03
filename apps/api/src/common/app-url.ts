export function getFrontendUrl(): string {
  return (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '');
}

export function getApiPublicUrl(): string {
  return (process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3002}`).replace(
    /\/$/,
    '',
  );
}

export function buildFormUrl(sectionCode: string): string {
  return `${getFrontendUrl()}/field/scan/${encodeURIComponent(sectionCode)}`;
}

export function buildCheckOutUrl(): string {
  return `${getFrontendUrl()}/attendance/check-out`;
}

export function buildQrApiUrl(sectionCode: string): string {
  return `${getApiPublicUrl()}/api/qr/${encodeURIComponent(sectionCode)}`;
}

export function buildCheckOutQrApiUrl(): string {
  return `${getApiPublicUrl()}/api/qr/checkout`;
}

export function buildMapLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
