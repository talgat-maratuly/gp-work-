import { apiRequest } from './client'

export type DispatcherData = {
  date: string
  generatedAt: string
  summary: {
    checkedIn: number
    late: number
    activeBrigades: number
    routes: number
    activeVehicles: number
    waterTrucks: number
    overdueStops: number
    problems: number
  }
  objects: { sectionId: number; sectionName: string; objectId: number; objectName: string | null; latitude: number; longitude: number; radiusMeters: number | null }[]
  teams: { userId: number; userName: string; brigadeId: number | null; brigadeName: string | null; routeId: number | null; latitude: number; longitude: number; accuracy: number | null; recordedAt: string; stale: boolean }[]
  routes: { id: number; workDate: string; status: string; brigade: { id: number; name: string }; stops: { id: number; position: number; status: string; plannedArrivalAt: string | null; arrivedAt: string | null; section: { name: string; object?: { name: string } } }[] }[]
  activeAssignments: { vehicleId: number; vehicleName: string; vehicleType: string; status: string; brigade: string | null; routeId: number | null; startsAt: string }[]
  overdueStops: { routeId: number; brigade: string; stopId: number; object: string | null; plannedArrivalAt: string }[]
  problems: { executionId: number; status: string; taskId: number; task: string; object: string | null; worker: string; updatedAt: string }[]
  events: { id: number; type: string; occurredAt: string; actor: string | null; executionId: number; task: string | null; object: string | null }[]
}

export type KpiRow = {
  key: string
  name: string
  executions: number
  accepted: number
  acceptedPercent: number
  completedOnTime: number
  overdue: number
  lateArrivals: number
  averageDurationMinutes: number | null
  reworks: number
  rejected: number
  materialQuantity: number
  objectCount: number
  routeCompliancePercent: number
}

export type KpiData = {
  filters: { dateFrom: string; dateTo: string; groupBy: 'employee' | 'brigade' | 'object' }
  disclaimer: string
  rows: KpiRow[]
}

export type EvidenceReport = {
  filters: { dateFrom: string; dateTo: string }
  summary: { total: number; accepted: number; awaitingReview: number; rejected: number; withCompleteEvidence: number }
  rows: {
    id: number
    status: string
    task: { id: number; description: string; dueDate: string | null; workType: string | null }
    object: { id: number | null; name: string | null; section: string }
    worker: { id: number; name: string }
    brigade: { id: number; name: string } | null
    timeline: { arrivedAt: string | null; startedAt: string | null; completedAt: string | null; acceptedAt: string | null; durationMinutes: number | null }
    location: { latitude: number | null; longitude: number | null; accuracy: number | null; distanceMeters: number | null }
    face: { status: string; selfieUrl: string; reviewedAt: string | null; reviewedBy: string | null } | null
    photos: { phase: string; url: string; capturedAt: string; latitude: number | null; longitude: number | null }[]
    checklist: { label: string; required: boolean; completed: boolean; completedAt: string | null }[]
    materials: { product: string | null; quantity: number; type: string; movementId: number }[]
    audit: { type: string; occurredAt: string; actor: string | null; latitude: number | null; longitude: number | null }[]
  }[]
}

function query(params: Record<string, string | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => { if (value) search.set(key, value) })
  return search.toString()
}

export const fetchDispatcher = (date?: string) => apiRequest<DispatcherData>(`/operations/dispatcher${date ? `?date=${date}` : ''}`)
export const fetchKpi = (params: { anchor?: string; period?: 'day' | 'week' | 'month'; dateFrom?: string; dateTo?: string; groupBy?: 'employee' | 'brigade' | 'object' }) => apiRequest<KpiData>(`/operations/kpi?${query(params)}`)
export const fetchEvidenceReport = (params: { anchor?: string; period?: 'day' | 'week' | 'month'; dateFrom?: string; dateTo?: string }) => apiRequest<EvidenceReport>(`/operations/reports/evidence?${query(params)}`)
