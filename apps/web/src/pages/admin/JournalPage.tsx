import { useCallback, useEffect, useState } from 'react'
import {
  WorkLogFiltersPanel,
  filtersToApi,
  type FilterState,
} from '@/components/WorkLogFilters'
import { WorkLogTable } from '@/components/WorkLogTable'
import { Button } from '@/components/ui/Button'
import { fetchObjects } from '@/api/objectsApi'
import { fetchSections } from '@/api/sectionsApi'
import { fetchAllWorkTypes } from '@/api/workTypesApi'
import { quickFilterRange, toDateInput } from '@/lib/dateFilters'
import type { QuickFilterId } from '@/lib/constants'
import { exportWorkLogsToExcel } from '@/lib/excel'
import { fetchWorkLogs, reviewWorkLog } from '@/lib/workLogsApi'
import { onSectionsChanged } from '@/lib/sectionEvents'
import { useAuth } from '@/context/AuthContext'
import type { NurseryObject, Section, WorkLog, WorkType } from '@/lib/types'

const defaultFilters = (): FilterState => {
  const today = toDateInput(new Date())
  return {
    dateFrom: today,
    dateTo: today,
    workerName: '',
    objectId: '',
    sectionId: '',
    workTypeId: '',
  }
}

export function JournalPage() {
  const { hasRole } = useAuth()
  const canReview = hasRole('ADMIN', 'BRIGADIER', 'AGRONOMIST')
  const [filters, setFilters] = useState(defaultFilters)
  const [logs, setLogs] = useState<WorkLog[]>([])
  const [loading, setLoading] = useState(true)
  const [objects, setObjects] = useState<NurseryObject[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [workTypes, setWorkTypes] = useState<WorkType[]>([])

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchWorkLogs(filtersToApi(filters))
      setLogs(data)
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

  async function handleReview(log: WorkLog, status: 'APPROVED' | 'REJECTED') {
    const comment = window.prompt(
      status === 'APPROVED' ? 'Комментарий проверки (необязательно):' : 'Причина отклонения:'
    )
    if (status === 'REJECTED' && comment === null) return
    try {
      await reviewWorkLog(log.id, { reviewStatus: status, reviewComment: comment || undefined })
      await loadLogs()
    } catch (err) {
      console.error('[journal] review:', err)
      alert('Не удалось сохранить проверку')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Журнал работ</h1>
        <Button
          variant="secondary"
          onClick={() =>
            exportWorkLogsToExcel(
              logs,
              filters.dateFrom || toDateInput(new Date()),
              filters.dateTo || toDateInput(new Date()),
              filtersToApi(filters)
            )
          }
        >
          Скачать Excel
        </Button>
      </div>

      <WorkLogFiltersPanel
        filters={filters}
        onChange={setFilters}
        onQuickFilter={applyQuick}
        objects={objects}
        sections={sections}
        workTypes={workTypes}
      />

      <div className="flex gap-2">
        <Button onClick={() => void loadLogs()}>Применить фильтры</Button>
      </div>

      <WorkLogTable
        logs={logs}
        loading={loading}
        canReview={canReview}
        onReview={(log, status) => void handleReview(log, status)}
      />
    </div>
  )
}
