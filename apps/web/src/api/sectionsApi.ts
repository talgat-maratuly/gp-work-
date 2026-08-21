import { apiRequest } from './client'
import { mapSection, type ApiSection } from './mappers'
import { notifySectionsChanged } from '@/lib/sectionEvents'
import type { Section } from '@/lib/types'

export async function fetchSections(): Promise<Section[]> {
  const data = await apiRequest<ApiSection[]>('/sections')
  return data.map(mapSection)
}

export async function fetchSectionByCode(code: string): Promise<Section> {
  const data = await apiRequest<ApiSection>(`/sections/code/${encodeURIComponent(code)}`)
  return mapSection(data)
}

export async function fetchSectionById(id: number): Promise<Section> {
  const data = await apiRequest<ApiSection>(`/sections/${id}`)
  return mapSection(data)
}

export async function createSection(payload: {
  objectId: number
  name: string
  area?: string
  culture?: string
  customText?: string
}): Promise<Section> {
  const data = await apiRequest<ApiSection>('/sections', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return mapSection(data)
}

export async function updateSection(
  id: number,
  payload: {
    objectId?: number
    name?: string
    area?: string
    culture?: string
    customText?: string
  }
): Promise<Section> {
  const data = await apiRequest<ApiSection>(`/sections/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return mapSection(data)
}

export async function deleteSection(id: number): Promise<void> {
  await apiRequest(`/sections/${id}`, { method: 'DELETE' })
  notifySectionsChanged()
}
