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
  type: VehicleType
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

export type NurseryMovementType = 'INCOME' | 'TRANSFER' | 'RESERVE' | 'RELEASE' | 'ISSUE' | 'RETURN' | 'WRITE_OFF' | 'CORRECTION'
export type NurseryBatch = {
  id: number
  batchCode: string
  culture: string
  variety: string | null
  quantity: string
  reservedQuantity: string
  unit: string
  size: string | null
  ageMonths: number | null
  location: string | null
  condition: string | null
  status: 'AVAILABLE' | 'RESERVED' | 'ISSUED' | 'DAMAGED' | 'WRITTEN_OFF'
  receivedAt: string | null
  comment: string | null
}

export type NurseryMovement = {
  id: number
  batchId: number
  type: NurseryMovementType
  quantity: string
  balanceAfter: string
  objectId: number | null
  taskId: number | null
  executionId: number | null
  fromLocation: string | null
  toLocation: string | null
  comment: string | null
  createdAt: string
  batch?: NurseryBatch
  object?: { id: number; name: string } | null
  task?: { id: number; description: string } | null
}

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  CAR: 'Автомобиль', WATER_TRUCK: 'Водовоз', MOWER: 'Газонокосилка', PUMP: 'Насос',
  GENERATOR: 'Генератор', DRILLING_RIG: 'Буровая установка', EQUIPMENT: 'Оборудование',
}
export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  FREE: 'Свободен', ASSIGNED: 'Назначен', IN_WORK: 'В работе', REPAIR: 'Ремонт', UNAVAILABLE: 'Недоступен',
}
export const NURSERY_MOVEMENT_LABELS: Record<NurseryMovementType, string> = {
  INCOME: 'Приход', TRANSFER: 'Перемещение', RESERVE: 'Резерв', RELEASE: 'Снять резерв',
  ISSUE: 'Выдача на объект', RETURN: 'Возврат', WRITE_OFF: 'Списание', CORRECTION: 'Корректировка',
}

export const fetchVehicles = () => apiRequest<Vehicle[]>('/resources/vehicles')
export const createVehicle = (body: { code: string; name: string; type: VehicleType; registrationNumber?: string; responsibleUserId?: number; odometer?: number; engineHours?: number; comment?: string }) =>
  apiRequest<Vehicle>('/resources/vehicles', { method: 'POST', body: JSON.stringify(body) })
export const setVehicleStatus = (id: number, status: VehicleStatus, comment?: string) =>
  apiRequest<Vehicle>(`/resources/vehicles/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, comment }) })
export const assignVehicle = (id: number, body: { brigadeId?: number; routeId?: number; taskId?: number; executionId?: number; startsAt: string; startMeter?: number; comment?: string }) =>
  apiRequest<VehicleAssignment>(`/resources/vehicles/${id}/assignments`, { method: 'POST', body: JSON.stringify(body) })
export const completeVehicleAssignment = (id: number, body: { endMeter?: number; comment?: string }) =>
  apiRequest<VehicleAssignment>(`/resources/vehicle-assignments/${id}/complete`, { method: 'POST', body: JSON.stringify(body) })

export const fetchNurseryBatches = () => apiRequest<NurseryBatch[]>('/resources/nursery/batches')
export const createNurseryBatch = (body: { batchCode: string; culture: string; variety?: string; quantity: number; unit?: string; size?: string; ageMonths?: number; location?: string; condition?: string; receivedAt?: string; comment?: string }) =>
  apiRequest<NurseryBatch>('/resources/nursery/batches', { method: 'POST', body: JSON.stringify(body) })
export const fetchNurseryMovements = (batchId?: number) =>
  apiRequest<NurseryMovement[]>(`/resources/nursery/movements${batchId ? `?batchId=${batchId}` : ''}`)
export const createNurseryMovement = (body: { batchId: number; type: NurseryMovementType; quantity: number; objectId?: number; taskId?: number; brigadeId?: number; routeId?: number; executionId?: number; fromLocation?: string; toLocation?: string; clientOperationId?: string; comment?: string }) =>
  apiRequest<NurseryMovement>('/resources/nursery/movements', { method: 'POST', body: JSON.stringify(body) })
