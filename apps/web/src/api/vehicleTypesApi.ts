import { apiRequest } from './client'

export type VehicleTypeRef = {
  id: number
  key: string
  name: string
  sortOrder: number
  isActive: boolean
  isSystem: boolean
  createdAt?: string
}

export const fetchAllVehicleTypes = () => apiRequest<VehicleTypeRef[]>('/vehicle-types')
export const fetchActiveVehicleTypes = () => apiRequest<VehicleTypeRef[]>('/vehicle-types/active')
export const createVehicleType = (name: string) =>
  apiRequest<VehicleTypeRef>('/vehicle-types', { method: 'POST', body: JSON.stringify({ name }) })
export const updateVehicleType = (
  id: number,
  patch: { name?: string; isActive?: boolean; sortOrder?: number },
) => apiRequest<VehicleTypeRef>(`/vehicle-types/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const archiveVehicleType = (id: number) =>
  apiRequest<VehicleTypeRef>(`/vehicle-types/${id}`, { method: 'DELETE' })
