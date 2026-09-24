const TOKEN_KEY = 'gp-work_token'
const USER_KEY = 'gp-work_user'

const AUTH_STORAGE_KEYS = [TOKEN_KEY, USER_KEY, 'gp-work_role', 'role'] as const

export type UserRole =
  | 'DIRECTOR'
  | 'ADMIN'
  | 'ACCOUNTANT'
  | 'BRIGADIER'
  | 'AGRONOMIST'
  | 'WORKER'
  | 'WATER_CARRIER'
  | 'AKIMAT'
  | 'ANTICOR'

export const EMPLOYEE_ROLES: readonly UserRole[] = ['ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'BRIGADIER', 'AGRONOMIST', 'WORKER', 'WATER_CARRIER']

export interface AuthUser {
  id: number
  fullName: string
  username: string
  role: UserRole
  accessRoleId?: number | null
  roleName?: string | null
  permissions?: string[] | null
  pages?: string[] | null
  pageNames?: Record<string,string> | null
  canJoinBrigade?: boolean
  positionId?: number | null
  positionName?: string | null
  brigadeId: number | null
  isActive: boolean
  mustChangePassword?: boolean
  createdAt: string
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function setStoredUser(user: AuthUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function clearAuth() {
  if ('caches' in globalThis) void caches.delete('gp-work-photos').catch(() => undefined)
  for (const key of AUTH_STORAGE_KEYS) {
    localStorage.removeItem(key)
    try {
      sessionStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}

export const ROLE_LABELS: Record<UserRole, string> = {
  DIRECTOR: 'Директор',
  ADMIN: 'Администратор',
  ACCOUNTANT: 'Бухгалтер',
  BRIGADIER: 'Бригадир',
  AGRONOMIST: 'Агроном',
  WORKER: 'Рабочий',
  WATER_CARRIER: 'Водовоз',
  AKIMAT: 'Акимат',
  ANTICOR: 'Антикор',
}
