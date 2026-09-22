import type { UserRole } from '@/lib/auth'

export function isSectionFormPath(path?: string): boolean {
  if (!path) return false
  if (/^\/(?:field\/scan|work-form)\/[^/?#]+\/?(?:[?#].*)?$/.test(path)) return true
  const legacyQuery = path.match(/^\/work-form\/?\?([^#]*)/)
  if (!legacyQuery) return false
  const sectionId = Number(new URLSearchParams(legacyQuery[1]).get('sectionId'))
  return Number.isInteger(sectionId) && sectionId > 0
}

export function returnPathAfterLogout(path?: string): string | undefined {
  // Shared resource links are re-authorized for the next account by the API.
  // Cabinet URLs belong to the previous session and must be discarded.
  return isSectionFormPath(path) || (path && /^\/workflow\/tasks\/[1-9]\d*(?:[?#].*)?$/.test(path))
    ? path : undefined
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
  if (from === '/change-password') return from
  if (role === 'ACCOUNTANT' && !['/my-work-day', '/admin/attendance', '/admin/daily-reports', '/admin/workflow'].includes(from.split('?')[0])) return homePathForRole(role)
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
