import { buildMapLink } from '@/lib/appConfig'
import { resolveAssetUrl } from './client'
import type { NurseryObject, Section, WorkLog, WorkType } from '@/lib/types'

export type ApiObject = {
  id: number
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  sections?: ApiSection[]
}

export type ApiSection = {
  id: number
  objectId: number
  code: string
  name: string
  area: string | null
  culture: string | null
  customText: string | null
  qrCodeUrl: string | null
  formUrl: string | null
  latitude: number | null
  longitude: number | null
  radiusMeters: number | null
  createdAt: string
  updatedAt: string
  object?: ApiObject
}

export type ApiWorkType = {
  id: number
  name: string
  isActive: boolean
  isOther: boolean
  createdAt: string
  updatedAt: string
}

export type ApiWorkLog = {
  id: number
  sectionId: number
  workerFullName: string
  workTypeId: number | null
  customWorkType: string | null
  workVolume: string
  comment: string
  photoUrls: string[]
  latitude: number | null
  longitude: number | null
  locationAccuracy: number | null
  locationAllowed: boolean
  submittedAt: string
  createdAt: string
  taskId?: number | null
  reviewStatus?: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewComment?: string | null
  reviewedAt?: string | null
  reviewedBy?: { id: number; fullName: string } | null
  section?: ApiSection & { object?: ApiObject }
  workType?: ApiWorkType | null
}

export function mapObject(o: ApiObject): NurseryObject {
  return {
    id: o.id,
    name: o.name,
    description: o.description,
    created_at: o.createdAt,
  }
}

export function mapSection(s: ApiSection): Section {
  return {
    id: s.id,
    object_id: s.objectId,
    code: s.code,
    name: s.name,
    area: s.area,
    culture: s.culture,
    description: s.customText,
    qr_code_url: s.qrCodeUrl,
    created_at: s.createdAt,
    objects: s.object ? mapObject(s.object) : undefined,
  }
}

export function mapWorkType(t: ApiWorkType): WorkType {
  return {
    id: t.id,
    name: t.name,
    is_active: t.isActive,
    is_other: t.isOther,
    created_at: t.createdAt,
  }
}

export function mapWorkLog(w: ApiWorkLog): WorkLog {
  const hasGeo = w.latitude != null && w.longitude != null
  return {
    id: w.id,
    section_id: w.sectionId,
    worker_full_name: w.workerFullName,
    work_type_id: w.workTypeId,
    custom_work_type: w.customWorkType,
    work_volume: w.workVolume,
    comment: w.comment,
    photo_urls: (w.photoUrls ?? []).map(resolveAssetUrl),
    latitude: w.latitude,
    longitude: w.longitude,
    geo_accuracy: w.locationAccuracy,
    map_url: hasGeo ? buildMapLink(w.latitude!, w.longitude!) : null,
    submitted_at: w.submittedAt,
    created_at: w.createdAt,
    task_id: w.taskId ?? null,
    review_status: w.reviewStatus ?? 'PENDING',
    review_comment: w.reviewComment ?? null,
    reviewed_at: w.reviewedAt ?? null,
    reviewed_by_name: w.reviewedBy?.fullName ?? null,
    sections: w.section
      ? {
          ...mapSection(w.section),
          objects: w.section.object ? mapObject(w.section.object) : undefined,
        }
      : undefined,
    work_types: w.workType ? mapWorkType(w.workType) : null,
  }
}
