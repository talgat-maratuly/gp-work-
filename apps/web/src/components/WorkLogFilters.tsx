import { QUICK_FILTERS, type QuickFilterId } from '@/lib/constants'
import type { NurseryObject, Section, WorkType } from '@/lib/types'
import { Input } from './ui/Input'
import { Select } from './ui/Select'

export interface FilterState {
  dateFrom: string
  dateTo: string
  workerName: string
  objectId: string
  sectionId: string
  workTypeId: string
}

interface Props {
  filters: FilterState
  onChange: (f: FilterState) => void
  onQuickFilter: (id: QuickFilterId) => void
  objects: NurseryObject[]
  sections: Section[]
  workTypes: WorkType[]
}

export function WorkLogFiltersPanel({
  filters,
  onChange,
  onQuickFilter,
  objects,
  sections,
  workTypes,
}: Props) {
  const filteredSections = filters.objectId
    ? sections.filter((s) => s.object_id === Number(filters.objectId))
    : sections

  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch })

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => onQuickFilter(q.id)}
            className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
          >
            {q.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Input
          label="Дата с"
          type="date"
          value={filters.dateFrom}
          onChange={(e) => set({ dateFrom: e.target.value })}
        />
        <Input
          label="Дата по"
          type="date"
          value={filters.dateTo}
          onChange={(e) => set({ dateTo: e.target.value })}
        />
        <Input
          label="ФИО работника"
          value={filters.workerName}
          onChange={(e) => set({ workerName: e.target.value })}
          placeholder="Поиск по ФИО"
        />
        <Select
          label="Объект"
          value={filters.objectId}
          onChange={(e) => set({ objectId: e.target.value, sectionId: '' })}
          options={[
            { value: '', label: 'Все объекты' },
            ...objects.map((o) => ({ value: o.id, label: o.name })),
          ]}
        />
        <Select
          label="Участок"
          value={filters.sectionId}
          onChange={(e) => set({ sectionId: e.target.value })}
          options={[
            { value: '', label: 'Все участки' },
            ...filteredSections.map((s) => ({
              value: s.id,
              label: `${s.name} (${s.code})`,
            })),
          ]}
        />
        <Select
          label="Вид работы"
          value={filters.workTypeId}
          onChange={(e) => set({ workTypeId: e.target.value })}
          options={[
            { value: '', label: 'Все виды' },
            ...workTypes
              .filter((w) => w.is_active)
              .map((w) => ({ value: w.id, label: w.name })),
          ]}
        />
      </div>
    </div>
  )
}

export function filtersToApi(f: FilterState) {
  return {
    dateFrom: f.dateFrom || undefined,
    dateTo: f.dateTo || undefined,
    workerName: f.workerName || undefined,
    objectId: f.objectId ? Number(f.objectId) : undefined,
    sectionId: f.sectionId ? Number(f.sectionId) : undefined,
    workTypeId: f.workTypeId ? Number(f.workTypeId) : undefined,
  }
}
