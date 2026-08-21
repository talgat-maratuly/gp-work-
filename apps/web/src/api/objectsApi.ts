import { apiRequest } from './client'
import { mapObject, mapSection, type ApiObject } from './mappers'
import type { NurseryObject, Section } from '@/lib/types'

export type NurseryObjectWithSections = NurseryObject & {
  sections: Section[]
}

export async function fetchObjects(): Promise<NurseryObject[]> {
  const data = await apiRequest<ApiObject[]>('/objects')
  return data.map(mapObject)
}

export async function fetchObjectsWithSections(): Promise<NurseryObjectWithSections[]> {
  const data = await apiRequest<ApiObject[]>('/objects')
  return data.map((o) => ({
    ...mapObject(o),
    sections: (o.sections ?? []).map(mapSection),
  }))
}

export async function createObject(payload: {
  name: string
  description?: string
}): Promise<NurseryObject> {
  const data = await apiRequest<ApiObject>('/objects', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return mapObject(data)
}

export async function updateObject(
  id: number,
  payload: { name?: string; description?: string }
): Promise<NurseryObject> {
  const data = await apiRequest<ApiObject>(`/objects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return mapObject(data)
}

export async function deleteObject(id: number): Promise<void> {
  await apiRequest(`/objects/${id}`, { method: 'DELETE' })
}
