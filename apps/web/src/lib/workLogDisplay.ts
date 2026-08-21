import type { WorkLog } from './types'

export function workTypeLabel(log: WorkLog): string {
  if (log.custom_work_type) return log.custom_work_type
  return log.work_types?.name ?? '—'
}

export function sectionLabel(log: WorkLog): string {
  const section = log.sections?.name ?? '—'
  const object = log.sections?.objects?.name
  if (object) return `${section} · ${object}`
  return section
}
