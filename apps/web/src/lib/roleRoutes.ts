import type { UserRole } from '@/lib/auth'

export function homePathForRole(role: UserRole): string {
  if (role === 'WORKER') return '/field/today'
  if (role === 'WATER_CARRIER') return '/admin/watering'
  return '/admin'
}

export function resolvePostLoginPath(role: UserRole, from?: string): string {
  if (!from || from === '/login') return homePathForRole(role)
  if (role === 'WORKER' && (from.startsWith('/admin') || from.startsWith('/worker'))) {
    return homePathForRole(role)
  }
  if (
    role === 'WATER_CARRIER' &&
    from.startsWith('/admin') &&
    !from.startsWith('/admin/watering')
  ) {
    return homePathForRole(role)
  }
  if (role !== 'WORKER' && from.startsWith('/worker')) return homePathForRole(role)
  return from
}
