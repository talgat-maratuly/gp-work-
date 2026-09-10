import type { UserRole } from '@/lib/auth'

export function aiLinksForRole(role?: UserRole) {
  if (role === 'ADMIN' || role === 'DIRECTOR') {
    return [
      { to: '/admin/ai-director', label: 'ИИ-директор', icon: '✦' },
      { to: '/admin/assistant', label: 'ИИ-ассистент', icon: '✧' },
    ]
  }
  if (role && ['WORKER', 'BRIGADIER', 'AGRONOMIST', 'WATER_CARRIER'].includes(role)) {
    return [{ to: '/field/assistant', label: 'ИИ-ассистент', icon: '✧' }]
  }
  return []
}
