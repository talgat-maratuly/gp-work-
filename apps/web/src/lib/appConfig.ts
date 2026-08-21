export function getAppBaseUrl(): string {
  return (
    import.meta.env.VITE_APP_URL?.replace(/\/$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://gp-work.gpartners.kz')
  )
}

export function getNurseryName(): string {
  return import.meta.env.VITE_NURSERY_NAME || 'Питомник'
}

function getApiOrigin(): string {
  const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/api'
  if (apiUrl.startsWith('http')) {
    return apiUrl.replace(/\/api$/, '') || apiUrl
  }
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return getAppBaseUrl()
}

export function buildWorkFormUrlBySectionCode(sectionCode: string): string {
  return `${getAppBaseUrl()}/work-form/${encodeURIComponent(sectionCode)}`
}

export function buildWorkFormUrl(objectId: number, sectionId: number): string {
  return `${getAppBaseUrl()}/work-form?objectId=${objectId}&sectionId=${sectionId}`
}

export function buildCheckOutUrl(): string {
  return `${getAppBaseUrl()}/attendance/check-out`
}

export function buildMapLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

export function buildQrImageUrl(sectionCode: string): string {
  return `${getApiOrigin()}/api/qr/${encodeURIComponent(sectionCode)}`
}

export function buildCheckOutQrImageUrl(): string {
  return `${getApiOrigin()}/api/attendance/check-out/qr.png`
}
