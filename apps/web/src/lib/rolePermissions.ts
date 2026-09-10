import type { UserRole } from '@/lib/auth'

const CONTROL_ROLES = ['ADMIN', 'BRIGADIER', 'AGRONOMIST', 'AKIMAT', 'ANTICOR'] as const
const FIELD_MANAGERS = ['ADMIN', 'BRIGADIER', 'AGRONOMIST'] as const

export const ADMIN_ROUTE_ROLES = {
  dashboard: CONTROL_ROLES,
  workLogs: CONTROL_ROLES,
  map: CONTROL_ROLES,
  objects: CONTROL_ROLES,
  workTypes: CONTROL_ROLES,
  photos: CONTROL_ROLES,
  dispatcher: CONTROL_ROLES,
  kpi: CONTROL_ROLES,
  evidenceReports: CONTROL_ROLES,
  schedule: CONTROL_ROLES,
  management: CONTROL_ROLES,
  watering: ['ADMIN', 'BRIGADIER', 'AGRONOMIST', 'WATER_CARRIER', 'AKIMAT', 'ANTICOR'],
  qr: ['ADMIN'],
  formSettings: ['ADMIN'],
  export: ['ADMIN'],
  users: ['ADMIN'],
  seed: ['ADMIN'],
  brigades: ['ADMIN', 'BRIGADIER'],
  tasks: FIELD_MANAGERS,
  routes: FIELD_MANAGERS,
  executions: FIELD_MANAGERS,
  attendance: FIELD_MANAGERS,
  workDays: FIELD_MANAGERS,
  dailyReports: ['ADMIN', 'AKIMAT', 'ANTICOR'],
  vehicles: FIELD_MANAGERS,
  nursery: FIELD_MANAGERS,
  warehouse: ['ADMIN', 'BRIGADIER'],
  warehouseExport: ['ADMIN'],
  productImport: ['ADMIN'],
  aiAssistant: ['ADMIN'],
  myTasks: ['BRIGADIER', 'AGRONOMIST'],
} as const satisfies Record<string, readonly UserRole[]>

export function canAccessRoles(role: UserRole, allowed: readonly UserRole[]): boolean {
  return allowed.includes(role) || (role === 'DIRECTOR' && allowed.includes('ADMIN'))
}
