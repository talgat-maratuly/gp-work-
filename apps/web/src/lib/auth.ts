const TOKEN_KEY = 'gp-work_token'
const USER_KEY = 'gp-work_user'

const AUTH_STORAGE_KEYS = [TOKEN_KEY, USER_KEY, 'gp-work_role', 'role'] as const

export type UserRole = 'ADMIN' | 'BRIGADIER' | 'AGRONOMIST' | 'WORKER'

export interface AuthUser {
  id: number
  fullName: string
  username: string
  role: UserRole
  brigadeId: number | null
  isActive: boolean
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
  ADMIN: 'Администратор',
  BRIGADIER: 'Бригадир',
  AGRONOMIST: 'Агроном',
  WORKER: 'Рабочий',
}
