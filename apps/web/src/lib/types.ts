export interface NurseryObject {
  id: number
  name: string
  description: string | null
  created_at: string
}

export interface Section {
  id: number
  object_id: number
  code: string
  name: string
  area: string | null
  culture: string | null
  description: string | null
  qr_code_url: string | null
  created_at: string
  objects?: NurseryObject
}

export interface WorkType {
  id: number
  name: string
  is_other: boolean
  is_active: boolean
  created_at: string
}

export interface WorkLog {
  id: number
  section_id: number
  worker_full_name: string
  work_type_id: number | null
  custom_work_type: string | null
  work_volume: string
  comment: string
  photo_urls: string[]
  latitude: number | null
  longitude: number | null
  geo_accuracy: number | null
  map_url: string | null
  submitted_at: string
  created_at: string
  task_id: number | null
  review_status: 'PENDING' | 'APPROVED' | 'REJECTED'
  review_comment: string | null
  reviewed_at: string | null
  reviewed_by_name: string | null
  sections?: Section & { objects?: NurseryObject }
  work_types?: WorkType | null
}

export interface WorkLogFilters {
  dateFrom?: string
  dateTo?: string
  workerName?: string
  objectId?: number
  sectionId?: number
  workTypeId?: number
}

export interface FormSettings {
  formTitle: string
  formDescription: string | null
  formSubmitText: string
  formSuccessText: string
  formHints: string | null
  fields: FormFieldSetting[]
}

export type FormFieldType = 'text' | 'number' | 'percent' | 'select' | 'boolean' | 'comment' | 'photo'

export interface FormFieldSetting {
  id: string
  label: string
  type: FormFieldType
  hint: string | null
  required: boolean
  visible: boolean
  order: number
  system: boolean
  options?: string[]
}
