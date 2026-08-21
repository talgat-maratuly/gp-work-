import { toUserMessage } from '@/api/client'
import * as api from '@/api/workTypesApi'

export async function fetchAllWorkTypes() {
  return api.fetchAllWorkTypes()
}

export async function fetchActiveWorkTypes() {
  return api.fetchActiveWorkTypes()
}

export async function createWorkType(
  name: string
): Promise<{ data: Awaited<ReturnType<typeof api.createWorkType>> | null; error: string | null }> {
  try {
    const data = await api.createWorkType(name)
    return { data, error: null }
  } catch (err) {
    console.error('[work_types] create:', err)
    return { data: null, error: toUserMessage(err, 'Не удалось сохранить вид работы') }
  }
}

export async function updateWorkType(
  id: number,
  name: string
): Promise<{ error: string | null }> {
  try {
    await api.updateWorkType(id, { name })
    return { error: null }
  } catch (err) {
    console.error('[work_types] update:', err)
    return { error: toUserMessage(err, 'Не удалось сохранить вид работы') }
  }
}

export async function toggleWorkTypeActive(
  id: number,
  isActive: boolean
): Promise<{ error: string | null }> {
  try {
    await api.updateWorkType(id, { isActive: !isActive })
    return { error: null }
  } catch (err) {
    console.error('[work_types] toggle:', err)
    return { error: toUserMessage(err, 'Не удалось сохранить вид работы') }
  }
}

export async function deleteWorkType(id: number): Promise<{ error: string | null }> {
  try {
    await api.deleteWorkType(id)
    return { error: null }
  } catch (err) {
    console.error('[work_types] delete:', err)
    return { error: toUserMessage(err, 'Не удалось сохранить вид работы') }
  }
}
