import type { UserRole } from '@/lib/auth'

// DEPUTY_DIRECTOR (Зам. директора): полный просмотр операционных разделов и
// постановка задач. Запись в остальных разделах отклоняется на бэкенде.
const CONTROL_ROLES = ['ADMIN', 'DEPUTY_DIRECTOR', 'BRIGADIER', 'AGRONOMIST', 'AKIMAT', 'ANTICOR'] as const
const FIELD_MANAGERS = ['ADMIN', 'DEPUTY_DIRECTOR', 'BRIGADIER', 'AGRONOMIST'] as const

export const ADMIN_ROUTE_ROLES = {
  director: ['DIRECTOR'],
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
  watering: ['ADMIN', 'DEPUTY_DIRECTOR', 'BRIGADIER', 'AGRONOMIST', 'WATER_CARRIER', 'AKIMAT', 'ANTICOR'],
  qr: ['ADMIN'],
  formSettings: ['ADMIN'],
  businessProcesses: ['ADMIN'],
  export: ['ADMIN'],
  users: ['ADMIN'],
  seed: ['ADMIN'],
  brigades: ['ADMIN', 'DEPUTY_DIRECTOR', 'BRIGADIER'],
  tasks: FIELD_MANAGERS,
  workflow: [...FIELD_MANAGERS, 'ACCOUNTANT'],
  routes: FIELD_MANAGERS,
  executions: FIELD_MANAGERS,
  attendance: [...FIELD_MANAGERS, 'ACCOUNTANT'],
  workDays: FIELD_MANAGERS,
  dailyReports: ['ADMIN', 'DEPUTY_DIRECTOR', 'ACCOUNTANT', 'AKIMAT', 'ANTICOR'],
  vehicles: FIELD_MANAGERS,
  warehouse: ['ADMIN', 'BRIGADIER'],
  warehouseExport: ['ADMIN'],
  productImport: ['ADMIN'],
  aiAssistant: ['ADMIN', 'BRIGADIER', 'AGRONOMIST', 'WATER_CARRIER'],
  aiDirector: ['ADMIN'],
  myTasks: ['BRIGADIER', 'AGRONOMIST'],
} as const satisfies Record<string, readonly UserRole[]>

export function canAccessRoles(role: UserRole, allowed: readonly UserRole[]): boolean {
  return allowed.includes(role) || (role === 'DIRECTOR' && allowed.includes('ADMIN'))
}
