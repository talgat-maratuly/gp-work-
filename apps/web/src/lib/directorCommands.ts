// Conservative draft preparation, not an AI model. Ambiguity stays unresolved.
export type CommandCatalog = {
  sections: { id: number; name: string; code: string; objectName: string }[]
  workTypes: { id: number; name: string }[]
  assignees: { id: number; fullName: string }[]
  tasks: { sectionId: number; workTypeId: number | null; assigneeUserId: number | null; status: string }[]
}

export function businessDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Oral', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)?.value).join('-')
}

const normalize = (value: string) => value.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const contains = (text: string, label: string) => !!normalize(label) && ` ${normalize(text)} `.includes(` ${normalize(label)} `)
const uniqueId = (rows: { id: number }[]) => rows.length === 1 ? String(rows[0].id) : ''

export function prepareDirectorCommand(text: string, catalog: CommandCatalog, today = businessDate()) {
  const byCode = catalog.sections.filter((s) => contains(text, s.code))
  const byName = catalog.sections.filter((s) => contains(text, s.name))
  const scoped = byName.filter((s) => contains(text, s.objectName))
  const sectionId = uniqueId(byCode.length ? byCode : scoped.length ? scoped : byName)
  const workTypeId = uniqueId(catalog.workTypes.filter((w) => contains(text, w.name)))
  let assigneeUserId = uniqueId(catalog.assignees.filter((u) => contains(text, u.fullName)))
  let assignmentReason = assigneeUserId ? 'Исполнитель указан в поручении.' : ''
  // Only propose a known executor for this exact section and work type; never invent responsibility.
  if (!assigneeUserId && !catalog.assignees.some((u) => contains(text, u.fullName)) && sectionId && workTypeId) {
    const known = new Set(catalog.tasks.filter((t) => t.sectionId === Number(sectionId) && t.workTypeId === Number(workTypeId) && t.status === 'VERIFIED').map((t) => t.assigneeUserId))
    const candidates = catalog.assignees.filter((u) => known.has(u.id))
    const load = (id: number) => catalog.tasks.filter((t) => t.assigneeUserId === id && !['VERIFIED', 'CANCELLED'].includes(t.status)).length
    candidates.sort((a, b) => load(a.id) - load(b.id) || a.id - b.id)
    if (candidates.length) {
      assigneeUserId = String(candidates[0].id)
      assignmentReason = 'Предложен действующий исполнитель с подтверждённой работой этого вида на участке и наименьшим числом незакрытых задач. Проверьте назначение.'
    }
  }
  let dueDate = ''
  const dates = [...text.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map((m) => m[0])
  const relative = ['сегодня', 'завтра', 'послезавтра'].filter((word) => contains(text, word))
  if (dates.length === 1 && relative.length === 0) {
    const parsed = new Date(`${dates[0]}T12:00:00Z`)
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === dates[0]) dueDate = dates[0]
  } else if (!dates.length && relative.length === 1) {
    const date = new Date(`${today}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate() + ['сегодня', 'завтра', 'послезавтра'].indexOf(relative[0]))
    dueDate = date.toISOString().slice(0, 10)
  }
  return { sectionId, workTypeId, assigneeUserId, dueDate, assignmentReason }
}
