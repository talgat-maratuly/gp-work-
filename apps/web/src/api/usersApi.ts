import { apiRequest } from './client'
import type { UserRole } from '@/lib/auth'

export type ApiUser = {
  id: number
  fullName: string
  username: string
  role: UserRole
  brigadeId: number | null
  isActive: boolean
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
    password: string
    role: UserRole
    brigadeId: number | null
    isActive: boolean
  }>
): Promise<ApiUser> {
  return apiRequest<ApiUser>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export async function changeUserPassword(id: number, password: string): Promise<ApiUser> {
  return apiRequest<ApiUser>(`/users/${id}/password`, {
    method: 'PATCH',
    body: JSON.stringify({ password }),
  })
}

export async function deleteUser(id: number): Promise<void> {
  await apiRequest(`/users/${id}`, { method: 'DELETE' })
}
