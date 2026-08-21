import { apiRequest } from './client'

export type ApiBrigade = {
  id: number
  name: string
  brigadierId: number | null
  description: string | null
  isActive: boolean
  workerIds: number[]
  workers: { id: number; fullName: string; username: string }[]
  createdAt: string
  updatedAt: string
}

export async function fetchBrigades(): Promise<ApiBrigade[]> {
  return apiRequest<ApiBrigade[]>('/brigades')
}

export async function createBrigade(payload: {
  name: string
  brigadierId?: number
  description?: string
  isActive?: boolean
  workerIds?: number[]
}): Promise<ApiBrigade> {
  return apiRequest<ApiBrigade>('/brigades', { method: 'POST', body: JSON.stringify(payload) })
}

export async function updateBrigade(
  id: number,
  payload: Partial<{
    name: string
    brigadierId: number | null
    description: string
    isActive: boolean
    workerIds: number[]
  }>
): Promise<ApiBrigade> {
  return apiRequest<ApiBrigade>(`/brigades/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export async function deleteBrigade(id: number): Promise<void> {
  await apiRequest(`/brigades/${id}`, { method: 'DELETE' })
}
