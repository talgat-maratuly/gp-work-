import { apiRequest } from './client'
import type { UserRole } from '@/lib/auth'

export type TaskStatus =
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'CANCELLED'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'
export type TaskCategory = 'WORK' | 'AGRO'

export type ApiTask = {
  id: number
  sectionId: number
  workTypeId: number | null
  assigneeUserId: number | null
  brigadeId: number | null
  dueDate: string | null
  priority: TaskPriority
  description: string
  status: TaskStatus
  category: TaskCategory
  createdById: number | null
  acceptedAt: string | null
  completedAt: string | null
  completionPhotoUrls: string[]
  completionComment: string | null
  reviewedById: number | null
  reviewedAt: string | null
  reviewComment: string | null
  createdAt: string
  updatedAt: string
  section?: { id: number; name: string; code: string; object?: { name: string } }
  workType?: { id: number; name: string } | null
  assignee?: { id: number; fullName: string; role: UserRole } | null
  reviewedBy?: { id: number; fullName: string; role: UserRole } | null
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  ASSIGNED: 'Новая',
  ACCEPTED: 'Принята',
  IN_PROGRESS: 'В работе',
  COMPLETED: 'Завершена',
  VERIFIED: 'Проверена',
  REJECTED: 'Отклонена',
  CANCELLED: 'Отменена',
}

/** Подписи статуса в списке задач (админ / агроном) */
export const TASK_LIST_STATUS_LABELS: Record<TaskStatus, string> = {
  ASSIGNED: 'Новая',
  ACCEPTED: 'Принята',
  IN_PROGRESS: 'В работе',
  COMPLETED: 'На проверке',
  VERIFIED: 'Завершена',
  REJECTED: 'Отклонена',
  CANCELLED: 'Отменена',
}

export function getTaskReviewLabel(status: TaskStatus): string {
  if (status === 'COMPLETED') return 'Ожидает проверки'
  if (status === 'VERIFIED') return 'Подтверждено'
  if (status === 'REJECTED') return 'Отклонено'
  return '—'
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Низкий',
  MEDIUM: 'Средний',
  HIGH: 'Высокий',
}

export type MyTask = {
  id: number
  dueDate: string | null
  status: TaskStatus
  priority: TaskPriority
  description: string
  sectionName: string
  sectionCode: string
  objectName: string
  workTypeName: string | null
  acceptedAt: string | null
  completedAt: string | null
  completionPhotoUrls: string[]
  completionComment: string | null
  reviewedAt: string | null
  reviewComment: string | null
}

export async function fetchMyTasks(): Promise<MyTask[]> {
  return apiRequest<MyTask[]>('/tasks/my')
}

export async function fetchMyTask(id: number): Promise<MyTask> {
  return apiRequest<MyTask>(`/tasks/my/${id}`)
}

export async function acceptMyTask(id: number): Promise<MyTask> {
  return apiRequest<MyTask>(`/tasks/my/${id}/accept`, { method: 'POST' })
}

export async function startMyTask(id: number): Promise<MyTask> {
  return apiRequest<MyTask>(`/tasks/my/${id}/start`, { method: 'POST' })
}

export async function completeMyTask(
  id: number,
  payload: { photoUrls: string[]; comment?: string },
): Promise<MyTask> {
  return apiRequest<MyTask>(`/tasks/my/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchTasks(): Promise<ApiTask[]> {
  return apiRequest<ApiTask[]>('/tasks')
}

export async function fetchTask(id: number): Promise<ApiTask> {
  return apiRequest<ApiTask>(`/tasks/${id}`)
}

export async function createTask(payload: {
  sectionId: number
  workTypeId: number
  assigneeUserId: number
  dueDate: string
  priority?: TaskPriority
  description: string
  brigadeId?: number
  category?: TaskCategory
}): Promise<ApiTask> {
  return apiRequest<ApiTask>('/tasks', { method: 'POST', body: JSON.stringify(payload) })
}

export async function reviewTask(
  id: number,
  payload: { status: 'VERIFIED' | 'REJECTED'; reviewComment?: string },
): Promise<ApiTask> {
  return apiRequest<ApiTask>(`/tasks/${id}/review`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function updateTask(
  id: number,
  payload: Partial<{
    sectionId: number
    workTypeId: number
    assigneeUserId: number
    brigadeId: number
    dueDate: string
    priority: TaskPriority
    description: string
  }>,
): Promise<ApiTask> {
  return apiRequest<ApiTask>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export async function cancelTask(id: number): Promise<void> {
  await apiRequest(`/tasks/${id}`, { method: 'DELETE' })
}
