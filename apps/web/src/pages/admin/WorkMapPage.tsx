import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  WorkLogFiltersPanel,
  filtersToApi,
  type FilterState,
} from '@/components/WorkLogFilters'
import { WorkLogsMap, logsWithGeo } from '@/components/WorkLogsMap'
import { WorkMapDetail } from '@/components/WorkMapDetail'
import { Button } from '@/components/ui/Button'
import { fetchObjects } from '@/api/objectsApi'
import { fetchSections } from '@/api/sectionsApi'
import { fetchAllWorkTypes } from '@/api/workTypesApi'
import { quickFilterRange } from '@/lib/dateFilters'
import type { QuickFilterId } from '@/lib/constants'
import { fetchWorkLogs } from '@/lib/workLogsApi'
import { onSectionsChanged } from '@/lib/sectionEvents'
import type { NurseryObject, Section, WorkLog, WorkType } from '@/lib/types'

const defaultFilters = (): FilterState => ({
  dateFrom: '',
  dateTo: '',
  workerName: '',
  objectId: '',
  sectionId: '',
  workTypeId: '',
})

export function WorkMapPage() {
  const [filters, setFilters] = useState(defaultFilters)
  const [logs, setLogs] = useState<WorkLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<WorkLog | null>(null)
  const [objects, setObjects] = useState<NurseryObject[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [workTypes, setWorkTypes] = useState<WorkType[]>([])

  const geoLogs = useMemo(() => logsWithGeo(logs), [logs])
  const handleSelect = useCallback((log: WorkLog) => setSelected(log), [])

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchWorkLogs(filtersToApi(filters))
      setLogs(data)
      setSelected((prev) => {
        if (!prev) return null
        const next = data.find((l) => l.id === prev.id)
        return next && next.latitude != null ? next : null
      })
    } finally {
      setLoading(false)
    }
  }, [filters])

  const loadFilters = useCallback(async () => {
    const [o, s, w] = await Promise.all([fetchObjects(), fetchSections(), fetchAllWorkTypes()])
    setObjects(o)
    setSections(s)
    setWorkTypes(w)
  }, [])

  useEffect(() => {
    void loadFilters()
    return onSectionsChanged(() => {
      void loadFilters()
    })
  }, [loadFilters])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  function applyQuick(id: QuickFilterId) {
    const { from, to } = quickFilterRange(id)
    setFilters((f) => ({ ...f, dateFrom: from, dateTo: to }))
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Карта работ</h1>
        <p className="mt-1 text-sm text-slate-600">
          Все отчёты с геолокацией на карте. Нажмите на точку, чтобы открыть детали.
        </p>
      </div>

      <WorkLogFiltersPanel
        filters={filters}
        onChange={setFilters}
        onQuickFilter={applyQuick}
        objects={objects}
        sections={sections}
        workTypes={workTypes}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void loadLogs()}>Применить фильтры</Button>
        <span className="text-sm text-slate-600">
          {loading ? 'Загрузка…' : `На карте: ${geoLogs.length} из ${logs.length} записей`}
        </span>
      </div>

      {loading ? (
        <p className="py-12 text-center text-slate-500">Загрузка карты…</p>
      ) : geoLogs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-slate-500">
          Нет работ с геолокацией для выбранных фильтров
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="h-[min(70vh,560px)] lg:col-span-3">
            <WorkLogsMap
              logs={geoLogs}
              selectedId={selected?.id ?? null}
              onSelect={handleSelect}
            />
          </div>
          <div className="lg:col-span-2">
            <WorkMapDetail log={selected} />
          </div>
        </div>
      )}
    </div>
  )
}
