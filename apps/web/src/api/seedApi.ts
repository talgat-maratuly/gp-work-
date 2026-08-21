import { apiRequest } from './client'

export type SeedResult = {
  message: string
  workTypesCreated: number
  workTypesSkipped: number
  counterInitialized: boolean
}

export function runSeed(): Promise<SeedResult> {
  return apiRequest<SeedResult>('/seed/run', { method: 'POST' })
}
