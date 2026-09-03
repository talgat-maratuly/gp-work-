import { apiRequest } from './client'

export type ExecutionStatus =
  | 'ASSIGNED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'ACCEPTED'
  | 'REJECTED'

export type FieldTask = {
  id: number
  description: string
  dueDate: string | null
  status: string
  section: {
    id: number
    code: string
    name: string
    latitude: number | null
    longitude: number | null
    radiusMeters: number | null
    object?: { id: number; name: string }
  }
  workType?: { id: number; name: string } | null
  brigade?: { id: number; name: string } | null
  assignee?: { id: number; fullName: string } | null
  execution?: { id: number; clientExecutionId: string; status: ExecutionStatus } | null
}

export type RouteStop = {
  id: number
  position: number
  plannedArrivalAt: string | null
  status: string
  task: FieldTask
  section: FieldTask['section']
}

export type FieldRoute = {
  id: number
  workDate: string
  brigadeId: number
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  startedAt: string | null
  brigade: { id: number; name: string }
  stops: RouteStop[]
}

export type ChecklistItem = { id: number; label: string; isRequired: boolean; position: number }
export type ChecklistAnswer = { id: number; itemId: number; isCompleted: boolean; comment: string | null }
export type WorkPhoto = { id: number; clientPhotoId: string; phase: 'BEFORE' | 'AFTER' | 'ISSUE'; url: string; capturedAt: string }
export type FaceVerification = {
  id: number
  status: 'PENDING' | 'VERIFIED' | 'REJECTED'
  selfieUrl: string
  reviewComment: string | null
}

export type FieldExecution = {
  id: number
  clientExecutionId: string
  status: ExecutionStatus
  arrivedAt: string | null
  startedAt: string | null
  completedAt: string | null
  acceptedAt: string | null
  arrivalDistanceMeters: number | null
  task: FieldTask
  section: FieldTask['section']
  worker?: { id: number; fullName: string } | null
  photos: WorkPhoto[]
  availableChecklist: ChecklistItem[]
  checklist: ChecklistAnswer[]
  faceVerifications: FaceVerification[]
  materials?: {
    id: number
    productId: number
    type: string
    quantity: string
    balanceAfter: string
    createdAt: string
    product?: { id: number; name: string; unit: string | null }
  }[]
}

export const newClientId = () => crypto.randomUUID()

export function fetchFieldToday() {
  return apiRequest<{ date: string; tasks: FieldTask[] }>('/field/today')
}

export function fetchMyRoute() {
  return apiRequest<FieldRoute | null>('/routes/my/today')
}

export async function startRoute(id: number) {
  const route = await apiRequest<FieldRoute>(`/routes/${id}/start`, { method: 'POST' })
  window.dispatchEvent(new Event('gp-work-route-changed'))
  return route
}

export function fetchRoutes(date?: string) {
  return apiRequest<FieldRoute[]>(`/routes${date ? `?date=${encodeURIComponent(date)}` : ''}`)
}

export function createRoute(body: { workDate: string; brigadeId: number; stops: { taskId: number; plannedArrivalAt?: string }[]; comment?: string }) {
  return apiRequest<FieldRoute>('/routes', { method: 'POST', body: JSON.stringify(body) })
}

export function fetchExecution(id: number) {
  return apiRequest<FieldExecution>(`/field/executions/${id}`)
}

export function arriveAtTask(taskId: number, body: Record<string, unknown>) {
  return apiRequest<FieldExecution>(`/field/tasks/${taskId}/arrive`, { method: 'POST', body: JSON.stringify(body) })
}

export function captureFace(executionId: number, body: Record<string, unknown>) {
  return apiRequest<FieldExecution>(`/field/executions/${executionId}/face`, { method: 'POST', body: JSON.stringify(body) })
}

export function addExecutionPhotos(executionId: number, body: Record<string, unknown>) {
  return apiRequest<FieldExecution>(`/field/executions/${executionId}/photos`, { method: 'POST', body: JSON.stringify(body) })
}

export function startExecution(executionId: number, body: Record<string, unknown>) {
  return apiRequest<FieldExecution>(`/field/executions/${executionId}/start`, { method: 'POST', body: JSON.stringify(body) })
}

export function saveExecutionChecklist(executionId: number, body: Record<string, unknown>) {
  return apiRequest<FieldExecution>(`/field/executions/${executionId}/checklist`, { method: 'POST', body: JSON.stringify(body) })
}

export function completeExecution(executionId: number, body: Record<string, unknown>) {
  return apiRequest<FieldExecution>(`/field/executions/${executionId}/complete`, { method: 'POST', body: JSON.stringify(body) })
}

export function fetchReviewQueue() {
  return apiRequest<FieldExecution[]>('/field/executions/review-queue')
}

export function reviewFace(verificationId: number, status: 'VERIFIED' | 'REJECTED', reviewComment?: string) {
  return apiRequest<FieldExecution>(`/field/face/${verificationId}/review`, {
    method: 'POST',
    body: JSON.stringify({ clientOperationId: newClientId(), status, reviewComment }),
  })
}

export function reviewExecution(executionId: number, accepted: boolean, comment?: string) {
  return apiRequest<FieldExecution>(`/field/executions/${executionId}/review`, {
    method: 'POST',
    body: JSON.stringify({ clientOperationId: newClientId(), accepted, comment }),
  })
}

export function sendLocationBatch(body: {
  points: {
    clientOperationId: string
    routeId?: number
    latitude: number
    longitude: number
    accuracy?: number
    occurredAt: string
  }[]
}) {
  return apiRequest<{ received: number; created: number; duplicates: number }>('/field/locations/batch', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
