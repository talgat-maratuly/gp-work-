import { apiRequest } from './client'
import type { UserRole } from '@/lib/auth'

export type ApiUser = {
  id: number
  fullName: string
  username: string
  role: UserRole
  accessRoleId?: number | null
  roleName?: string | null
  canJoinBrigade?: boolean
  positionId: number | null
  positionName: string | null
  brigadeId: number | null
  isActive: boolean
  mustChangePassword: boolean
  createdAt: string
}

export type ApiAssignee = {
  id: number
  fullName: string
  role: UserRole
}

export async function fetchUsers(): Promise<ApiUser[]> {
  return apiRequest<ApiUser[]>('/users')
}

export async function fetchAssignableUsers(): Promise<ApiAssignee[]> {
  return apiRequest<ApiAssignee[]>('/users/assignees')
}

export async function createUser(payload: {
  fullName: string
  username: string
  password: string
  role: UserRole
  accessRoleId?: number | null
  positionId?: number | null
  brigadeId?: number
  isActive?: boolean
}): Promise<ApiUser> {
  return apiRequest<ApiUser>('/users', { method: 'POST', body: JSON.stringify(payload) })
}

export async function updateUser(
  id: number,
  payload: Partial<{
    fullName: string
    username: string
    role: UserRole
    accessRoleId: number | null
    positionId: number | null
    brigadeId: number | null
    isActive: boolean
  }>
): Promise<ApiUser> {
  return apiRequest<ApiUser>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export type PasswordReset = {
  userId: number
  username: string
  fullName: string
  temporaryPassword: string
  expiresAt: string
}

export function resetUserPassword(id: number): Promise<PasswordReset> {
  return apiRequest<PasswordReset>(`/users/${id}/password-reset`, { method: 'POST', signal: AbortSignal.timeout(30_000) })
}
