import { apiRequest } from './client'

export type JobPosition = { id: number; name: string; isActive: boolean }

export const fetchJobPositions = () => apiRequest<JobPosition[]>('/job-positions')
export const createJobPosition = (name: string) => apiRequest<JobPosition>('/job-positions', {
  method: 'POST', body: JSON.stringify({ name }),
})
export const updateJobPosition = (id: number, data: { name?: string; isActive?: boolean }) =>
  apiRequest<JobPosition>(`/job-positions/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
