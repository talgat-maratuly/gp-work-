import { apiRequest } from './client'
import { mapWorkType, type ApiWorkType } from './mappers'
import type { WorkType } from '@/lib/types'

export async function fetchAllWorkTypes(): Promise<WorkType[]> {
  const data = await apiRequest<ApiWorkType[]>('/work-types')
  return data.map(mapWorkType)
}

export async function fetchActiveWorkTypes(): Promise<WorkType[]> {
  const data = await apiRequest<ApiWorkType[]>('/work-types/active')
  return data.map(mapWorkType)
}

export async function createWorkType(name: string): Promise<WorkType> {
  const data = await apiRequest<ApiWorkType>('/work-types', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
  return mapWorkType(data)
}

export async function updateWorkType(
  id: number,
  payload: { name?: string; isActive?: boolean }
): Promise<WorkType> {
  const data = await apiRequest<ApiWorkType>(`/work-types/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return mapWorkType(data)
}

export async function deleteWorkType(id: number): Promise<void> {
  await apiRequest(`/work-types/${id}`, { method: 'DELETE' })
}
