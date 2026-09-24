import type { ApiBrigade } from '@/api/brigadesApi'
import type { UserRole } from './auth'

export function canJoinBrigade(role: UserRole) {
  return ['BRIGADIER', 'AGRONOMIST', 'WORKER', 'WATER_CARRIER'].includes(role)
}

export function eligibleBrigades(brigades: ApiBrigade[], role: UserRole, userId?: number | null) {
  if (!canJoinBrigade(role)) return []
  return brigades.filter(brigade => brigade.isActive && (
    role !== 'BRIGADIER' || brigade.brigadierId == null || brigade.brigadierId === userId
  ))
}
