import type { UserRole } from '@/lib/auth'

export function isSectionFormPath(path?: string): boolean {
  if (!path) return false
  if (/^\/(?:field\/scan|work-form)\/[^/?#]+(?:[?#].*)?$/.test(path)) return true
  if (!path.startsWith('/work-form?')) return false
  const sectionId = Number(new URLSearchParams(path.slice('/work-form?'.length).split('#')[0]).get('sectionId'))
  return Number.isInteger(sectionId) && sectionId > 0
}

export function homePathForRole(role: UserRole): string {
  if (role === 'DIRECTOR') return '/admin/director'
  if (role === 'ACCOUNTANT') return '/admin/attendance'
  if (role === 'WORKER') return '/field/today'
  if (role === 'WATER_CARRIER') return '/admin/watering'
  return '/admin'
}

export function resolvePostLoginPath(role: UserRole, from?: string): string {
  if (!from || from === '/login') return homePathForRole(role)
  if (!from.startsWith('/') || from.startsWith('//')) return homePathForRole(role)
  if (role === 'ACCOUNTANT' && !['/admin/attendance', '/admin/daily-reports', '/admin/workflow'].includes(from.split('?')[0])) return homePathForRole(role)
  if (role !== 'WORKER' && from === '/field/assistant') return '/admin/assistant'
  const isSectionForm = isSectionFormPath(from)
  if (['ADMIN', 'DIRECTOR', 'AKIMAT', 'ANTICOR'].includes(role) && from.startsWith('/field') && !isSectionForm) return homePathForRole(role)
  if (role === 'DIRECTOR' && from === '/admin') return homePathForRole(role)
  if (role === 'WORKER' && (from.startsWith('/admin') || from.startsWith('/worker'))) {
    return homePathForRole(role)
  }
  if (
    role === 'WATER_CARRIER' &&
    from.startsWith('/admin') &&
    !from.startsWith('/admin/watering') && from !== '/admin/assistant'
  ) {
    return homePathForRole(role)
  }
  if (role !== 'WORKER' && from.startsWith('/worker')) return homePathForRole(role)
  return from
}
