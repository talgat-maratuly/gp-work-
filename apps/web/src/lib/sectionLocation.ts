import type { Section } from './types'

export type LocationDraft = { latitude: string; longitude: string; radius: string }

export const emptyLocation = (): LocationDraft => ({ latitude: '', longitude: '', radius: '150' })

export function locationDraft(section: Section): LocationDraft {
  return {
    latitude: section.latitude == null ? '' : String(section.latitude),
    longitude: section.longitude == null ? '' : String(section.longitude),
    radius: String(section.radius_meters ?? 150),
  }
}

export function locationPayload(draft: LocationDraft, required = false): { latitude?: number; longitude?: number; radiusMeters?: number } {
  const lat = draft.latitude.trim()
  const lon = draft.longitude.trim()
  if (!lat && !lon && !required) return {}
  if (!lat || !lon) throw new Error('Укажите широту и долготу вместе')
  const latitude = Number(lat.replace(',', '.'))
  const longitude = Number(lon.replace(',', '.'))
  const radiusMeters = Number(draft.radius.trim())
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90) throw new Error('Широта должна быть от −90 до 90')
  if (!Number.isFinite(longitude) || Math.abs(longitude) > 180) throw new Error('Долгота должна быть от −180 до 180')
  if (!Number.isInteger(radiusMeters) || radiusMeters < 10 || radiusMeters > 5000) throw new Error('Радиус должен быть целым числом от 10 до 5000 м')
  return { latitude, longitude, radiusMeters }
}

export function hasSectionLocation(section: Pick<Section, 'latitude' | 'longitude' | 'radius_meters'>): boolean {
  return section.latitude != null && Number.isFinite(section.latitude) && Math.abs(section.latitude) <= 90
    && section.longitude != null && Number.isFinite(section.longitude) && Math.abs(section.longitude) <= 180
    && Number.isInteger(section.radius_meters ?? 150) && (section.radius_meters ?? 150) >= 10 && (section.radius_meters ?? 150) <= 5000
}
