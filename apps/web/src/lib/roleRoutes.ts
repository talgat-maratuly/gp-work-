import type { UserRole } from '@/lib/auth'

export function homePathForRole(role: UserRole): string {
  return role === 'WORKER' ? '/worker/tasks' : '/admin'
}

export function resolvePostLoginPath(role: UserRole, from?: string): string {
  if (!from || from === '/login') return homePathForRole(role)
  if (role === 'WORKER' && from.startsWith('/admin')) return homePathForRole(role)
  if (role !== 'WORKER' && from.startsWith('/worker')) return homePathForRole(role)
  return from
}
