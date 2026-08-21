import { useCallback, useEffect, useState } from 'react'
import {
  WorkLogFiltersPanel,
  filtersToApi,
  type FilterState,
} from '@/components/WorkLogFilters'
import { Button } from '@/components/ui/Button'
import { fetchObjects } from '@/api/objectsApi'
import { fetchSections } from '@/api/sectionsApi'
import { fetchAllWorkTypes } from '@/api/workTypesApi'
import { toUserMessage } from '@/api/client'
import { quickFilterRange } from '@/lib/dateFilters'
import type { QuickFilterId } from '@/lib/constants'
import { exportWorkLogsToExcel } from '@/lib/excel'
import { fetchWorkLogs } from '@/lib/workLogsApi'
import { onSectionsChanged } from '@/lib/sectionEvents'
import type { NurseryObject, Section, WorkLog, WorkType } from '@/lib/types'

const emptyFilters = (): FilterState => ({
  dateFrom: '',
  dateTo: '',
  workerName: '',
  objectId: '',
  sectionId: '',
  workTypeId: '',
})

export function ExportPage() {
  const [filters, setFilters] = useState(emptyFilters)
  const [logs, setLogs] = useState<WorkLog[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [objects, setObjects] = useState<NurseryObject[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [workTypes, setWorkTypes] = useState<WorkType[]>([])

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      setLogs(await fetchWorkLogs(filtersToApi(filters)))
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

  function handleResetFilters() {
    setExportError(null)
    setFilters(emptyFilters())
  }

  async function handleExport() {
    setExportError(null)
    setExporting(true)
    try {
      const dateFrom = filters.dateFrom || 'all'
      const dateTo = filters.dateTo || 'all'
      await exportWorkLogsToExcel(logs, dateFrom, dateTo, filtersToApi(filters))
    } catch (err) {
      console.error('[export]', err)
      setExportError(toUserMessage(err))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Экспорт Excel</h1>
      <p className="text-sm text-slate-600">
        Найдено записей: {loading ? '…' : logs.length}. Файл формируется на сервере с учётом
        фильтров.
      </p>

      <WorkLogFiltersPanel
        filters={filters}
        onChange={setFilters}
        onQuickFilter={applyQuick}
        objects={objects}
        sections={sections}
        workTypes={workTypes}
      />

      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary"
          onClick={() => void handleExport()}
          disabled={exporting || loading}
          className="min-w-[160px] font-semibold text-white"
        >
          {exporting ? 'Скачивание…' : 'Скачать Excel'}
        </Button>
        <Button
          variant="secondary"
          onClick={handleResetFilters}
          disabled={loading}
          className="min-w-[160px] font-semibold text-slate-800"
        >
          Сбросить фильтры
        </Button>
      </div>

      {exportError && <p className="text-sm text-red-600">{exportError}</p>}
    </div>
  )
}
