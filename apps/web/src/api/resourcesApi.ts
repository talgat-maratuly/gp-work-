import { apiRequest } from './client'

export type VehicleType = 'CAR' | 'WATER_TRUCK' | 'MOWER' | 'PUMP' | 'GENERATOR' | 'DRILLING_RIG' | 'EQUIPMENT'
export type VehicleStatus = 'FREE' | 'ASSIGNED' | 'IN_WORK' | 'REPAIR' | 'UNAVAILABLE'
export type VehicleAssignmentStatus = 'ASSIGNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export type VehicleAssignment = {
  id: number
  vehicleId: number
  brigadeId: number | null
  routeId: number | null
  taskId: number | null
  executionId: number | null
  status: VehicleAssignmentStatus
  startsAt: string
  endsAt: string | null
  startMeter: string | null
  endMeter: string | null
  comment: string | null
  brigade?: { id: number; name: string } | null
  route?: { id: number; workDate: string } | null
}

export type Vehicle = {
  id: number
  code: string
  name: string
  type: string
  status: VehicleStatus
  registrationNumber: string | null
  responsibleUserId: number | null
  odometer: string | null
  engineHours: string | null
  comment: string | null
  isActive: boolean
  responsibleUser?: { id: number; fullName: string } | null
  assignments: VehicleAssignment[]
}

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  CAR: 'Автомобиль', WATER_TRUCK: 'Водовоз', MOWER: 'Газонокосилка', PUMP: 'Насос',
  GENERATOR: 'Генератор', DRILLING_RIG: 'Буровая установка', EQUIPMENT: 'Оборудование',
}
export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  FREE: 'Свободен', ASSIGNED: 'Назначен', IN_WORK: 'В работе', REPAIR: 'Ремонт', UNAVAILABLE: 'Недоступен',
}
export const fetchVehicles = () => apiRequest<Vehicle[]>('/resources/vehicles')
export const createVehicle = (body: { code: string; name: string; type: string; registrationNumber?: string; responsibleUserId?: number; odometer?: number; engineHours?: number; comment?: string }) =>
  apiRequest<Vehicle>('/resources/vehicles', { method: 'POST', body: JSON.stringify(body) })
export const setVehicleStatus = (id: number, status: VehicleStatus, comment?: string) =>
  apiRequest<Vehicle>(`/resources/vehicles/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, comment }) })
export const assignVehicle = (id: number, body: { brigadeId?: number; routeId?: number; taskId?: number; executionId?: number; startsAt: string; startMeter?: number; comment?: string }) =>
  apiRequest<VehicleAssignment>(`/resources/vehicles/${id}/assignments`, { method: 'POST', body: JSON.stringify(body) })
export const completeVehicleAssignment = (id: number, body: { endMeter?: number; comment?: string }) =>
  apiRequest<VehicleAssignment>(`/resources/vehicle-assignments/${id}/complete`, { method: 'POST', body: JSON.stringify(body) })
