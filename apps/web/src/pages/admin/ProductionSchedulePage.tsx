import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/Toast'
import { useAuth } from '@/context/AuthContext'
import { resolveAssetUrl, toUserMessage } from '@/api/client'
import { fetchObjects } from '@/api/objectsApi'
import { fetchBrigades, type ApiBrigade } from '@/api/brigadesApi'
import { fetchActiveWorkTypes } from '@/api/workTypesApi'
import { fetchAssignableUsers, type ApiAssignee } from '@/api/usersApi'
import type { NurseryObject, WorkType } from '@/lib/types'
import {
  createSchedule,
  deleteSchedule,
  fetchSchedule,
  SCHEDULE_STATUS_COLORS,
  SCHEDULE_STATUS_LABELS,
  SCHEDULE_STATUS_ORDER,
  updateSchedule,
  type ScheduleEntry,
  type ScheduleFilters,
  type SchedulePayload,
  type ScheduleStatus,
} from '@/api/scheduleApi'

// Цвета бригад для календаря (по индексу).
const BRIGADE_COLORS = [
  'bg-amber-400',
  'bg-emerald-400',
  'bg-sky-400',
  'bg-violet-400',
  'bg-rose-400',
  'bg-teal-400',
]

const currentMonth = () => new Date().toISOString().slice(0, 7)

function monthDays(month: string): number {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return 30
  return new Date(y, m, 0).getDate()
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${MONTH_NAMES[m - 1] ?? ''} ${y}`
}

export function ProductionSchedulePage() {
  const { hasRole } = useAuth()
  const canEdit = hasRole('DIRECTOR', 'ADMIN', 'BRIGADIER', 'AGRONOMIST')
  const canDelete = hasRole('DIRECTOR', 'ADMIN')

  const [month, setMonth] = useState(currentMonth())
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [objects, setObjects] = useState<NurseryObject[]>([])
  const [brigades, setBrigades] = useState<ApiBrigade[]>([])
  const [workTypes, setWorkTypes] = useState<WorkType[]>([])
  const [users, setUsers] = useState<ApiAssignee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState<ScheduleFilters>(() => {
    const f: ScheduleFilters = {}
    const status = searchParams.get('status')
    const objectId = searchParams.get('objectId')
    if (status) f.status = status as ScheduleStatus
    if (objectId) f.objectId = Number(objectId)
    return f
  })
  const [selected, setSelected] = useState<ScheduleEntry | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<SchedulePayload>({
    plannedDate: `${currentMonth()}-01`,
    objectId: 0,
  })
  const [dragId, setDragId] = useState<number | null>(null)

  const days = useMemo(() => {
    const n = monthDays(month)
    return Array.from({ length: n }, (_, i) => i + 1)
  }, [month])

  const brigadeColor = useCallback(
    (brigadeId: number | null) => {
      if (brigadeId == null) return 'bg-slate-300'
      const idx = brigades.findIndex((b) => b.id === brigadeId)
      return BRIGADE_COLORS[idx % BRIGADE_COLORS.length] ?? 'bg-slate-300'
    },
    [brigades],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setEntries(await fetchSchedule({ ...filters, month }))
    } catch (err) {
      setError(toUserMessage(err, 'Не удалось загрузить график'))
    } finally {
      setLoading(false)
    }
  }, [filters, month])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    fetchObjects().then(setObjects).catch(() => setObjects([]))
    fetchBrigades().then(setBrigades).catch(() => setBrigades([]))
    fetchActiveWorkTypes().then(setWorkTypes).catch(() => setWorkTypes([]))
    fetchAssignableUsers().then(setUsers).catch(() => setUsers([]))
  }, [])

  const entriesByCell = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>()
    for (const e of entries) {
      const objId = e.objectId ?? e.object?.id ?? null
      if (objId == null) continue
      const key = `${objId}__${e.plannedDate}`
      const list = map.get(key) ?? []
      list.push(e)
      map.set(key, list)
    }
    return map
  }, [entries])

  const patchFilter = (patch: Partial<ScheduleFilters>) =>
    setFilters((prev) => ({ ...prev, ...patch }))

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!createForm.objectId) {
      setToast('Выберите объект')
      return
    }
    try {
      await createSchedule({
        ...createForm,
        comment: createForm.comment?.trim() || undefined,
      })
      setToast('Работа добавлена в график')
      setShowCreate(false)
      setCreateForm({ plannedDate: `${month}-01`, objectId: 0 })
      await load()
    } catch (err) {
      setToast(toUserMessage(err, 'Не удалось создать работу'))
    }
  }

  async function handleStatusChange(entry: ScheduleEntry, status: ScheduleStatus) {
    try {
      let reason: string | undefined
      if (status === 'POSTPONED_RAIN' || status === 'POSTPONED_REASON') {
        reason = window.prompt('Причина переноса:') ?? undefined
      }
      const updated = await updateSchedule(entry.id, { status, rescheduleReason: reason })
      setToast('Статус обновлён')
      setSelected(updated)
      await load()
    } catch (err) {
      setToast(toUserMessage(err, 'Не удалось обновить статус'))
    }
  }

  async function handleDelete(entry: ScheduleEntry) {
    if (!window.confirm('Удалить работу из графика?')) return
    try {
      await deleteSchedule(entry.id)
      setToast('Удалено')
      setSelected(null)
      await load()
    } catch (err) {
      setToast(toUserMessage(err, 'Не удалось удалить'))
    }
  }

  async function handleDropOnDay(objectId: number, day: number) {
    if (dragId == null) return
    const entry = entries.find((e) => e.id === dragId)
    setDragId(null)
    if (!entry) return
    const newDate = `${month}-${String(day).padStart(2, '0')}`
    if (entry.plannedDate === newDate && (entry.objectId ?? entry.object?.id) === objectId) {
      return
    }
    try {
      await updateSchedule(entry.id, { plannedDate: newDate, objectId })
      setToast('Дата перенесена')
      await load()
    } catch (err) {
      setToast(toUserMessage(err, 'Не удалось перенести'))
    }
  }

  const objectName = useCallback(
    (id: number) => objects.find((o) => o.id === id)?.name ?? `Объект #${id}`,
    [objects],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">Производственный график</h1>
          <p className="text-sm text-slate-500">
            Календарь работ по объектам · перенос даты перетаскиванием
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => {
              setCreateForm({ plannedDate: `${month}-01`, objectId: 0 })
              setShowCreate(true)
            }}
          >
            + Создать работу
          </Button>
        )}
      </div>

      {/* Навигация по месяцам + фильтры */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white">
          <button
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="px-3 py-2 text-slate-600 hover:bg-slate-100"
          >
            ◀
          </button>
          <span className="min-w-[130px] text-center text-sm font-semibold text-slate-800">
            {monthLabel(month)}
          </span>
          <button
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="px-3 py-2 text-slate-600 hover:bg-slate-100"
          >
            ▶
          </button>
        </div>

        <select
          value={filters.objectId ?? ''}
          onChange={(e) => patchFilter({ objectId: e.target.value ? Number(e.target.value) : undefined })}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Все объекты</option>
          {objects.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <select
          value={filters.brigadeId ?? ''}
          onChange={(e) => patchFilter({ brigadeId: e.target.value ? Number(e.target.value) : undefined })}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Все бригады</option>
          {brigades.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          value={filters.workTypeId ?? ''}
          onChange={(e) => patchFilter({ workTypeId: e.target.value ? Number(e.target.value) : undefined })}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Все виды работ</option>
          {workTypes.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <select
          value={filters.status ?? ''}
          onChange={(e) => patchFilter({ status: (e.target.value || undefined) as ScheduleStatus })}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Все статусы</option>
          {SCHEDULE_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{SCHEDULE_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Календарь */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Загрузка…</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
          <p>{error}</p>
          <button onClick={load} className="mt-2 text-sm text-blue-700 underline">Повторить</button>
        </div>
      ) : objects.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Нет объектов. Сначала создайте объекты в разделе «Объекты и участки».
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">
                  Объект
                </th>
                {days.map((d) => (
                  <th
                    key={d}
                    className="min-w-[40px] border-b border-slate-200 bg-slate-50 px-1 py-2 text-center text-xs text-slate-500"
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {objects
                .filter((o) => !filters.objectId || o.id === filters.objectId)
                .map((obj) => (
                  <tr key={obj.id}>
                    <td className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-slate-200 bg-white px-3 py-2 font-medium text-slate-800">
                      {obj.name}
                    </td>
                    {days.map((d) => {
                      const dateStr = `${month}-${String(d).padStart(2, '0')}`
                      const cell = entriesByCell.get(`${obj.id}__${dateStr}`) ?? []
                      return (
                        <td
                          key={d}
                          onDragOver={(e) => {
                            if (canEdit) e.preventDefault()
                          }}
                          onDrop={() => canEdit && handleDropOnDay(obj.id, d)}
                          className="border-b border-l border-slate-100 p-0.5 align-top"
                        >
                          <div className="flex min-h-[28px] flex-col gap-0.5">
                            {cell.map((entry) => (
                              <button
                                key={entry.id}
                                draggable={canEdit}
                                onDragStart={() => setDragId(entry.id)}
                                onClick={() => setSelected(entry)}
                                title={`${entry.workTypeName ?? 'Работа'} · ${SCHEDULE_STATUS_LABELS[entry.status]}`}
                                className={`truncate rounded px-1 py-0.5 text-left text-[10px] font-medium ${SCHEDULE_STATUS_COLORS[entry.status]}`}
                              >
                                {entry.workTypeName ?? 'Работа'}
                              </button>
                            ))}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Легенда */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="mb-2 text-sm font-semibold text-slate-700">Статусы</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {SCHEDULE_STATUS_ORDER.map((s) => (
              <span key={s} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className={`inline-block h-3 w-3 rounded ${SCHEDULE_STATUS_COLORS[s].split(' ')[0]}`} />
                {SCHEDULE_STATUS_LABELS[s]}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="mb-2 text-sm font-semibold text-slate-700">Бригады</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {brigades.length === 0 && <span className="text-xs text-slate-400">Нет бригад</span>}
            {brigades.map((b) => (
              <span key={b.id} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className={`inline-block h-3 w-3 rounded ${brigadeColor(b.id)}`} />
                {b.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Боковая панель деталей */}
      {selected && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-blue-800">
              {selected.objectName ?? objectName(selected.objectId ?? 0)}
            </h2>
            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700">✕</button>
          </div>

          <dl className="space-y-1.5 text-sm">
            <Row label="Вид работы" value={selected.workTypeName ?? '—'} />
            <Row label="Бригада" value={selected.brigadeName ?? '—'} />
            <Row label="Плановая дата" value={selected.plannedDate} />
            <Row label="Исполнитель" value={selected.assignee?.fullName ?? '—'} />
            <Row label="Задача" value={selected.taskId ? `#${selected.taskId} (${selected.task?.status ?? ''})` : 'Не связана'} />
            <Row
              label="Статус"
              value={
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${SCHEDULE_STATUS_COLORS[selected.status]}`}>
                  {SCHEDULE_STATUS_LABELS[selected.status]}
                </span>
              }
            />
            <Row label="Фото" value={`${selected.task?.photoCount ?? 0}`} />
            <Row
              label="Гео"
              value={
                selected.latitude != null && selected.longitude != null ? (
                  <a className="text-blue-700 underline" target="_blank" rel="noreferrer"
                    href={`https://www.google.com/maps?q=${selected.latitude},${selected.longitude}`}>
                    на карте
                  </a>
                ) : '—'
              }
            />
            {selected.comment && <Row label="Комментарий" value={selected.comment} />}
            {selected.rescheduleReason && <Row label="Причина переноса" value={selected.rescheduleReason} />}
          </dl>

          {/* Фото до/процесс/после (из связанной задачи) */}
          {selected.task && selected.task.photoUrls.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Фотографии</p>
              <div className="grid grid-cols-3 gap-1">
                {selected.task.photoUrls.slice(0, 6).map((url, i) => (
                  <a key={i} href={resolveAssetUrl(url)} target="_blank" rel="noreferrer">
                    <img src={resolveAssetUrl(url)} alt="" className="h-16 w-full rounded object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {canEdit && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Изменить статус</p>
              <div className="flex flex-wrap gap-1">
                {SCHEDULE_STATUS_ORDER.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(selected, s)}
                    className={`rounded px-2 py-1 text-[11px] font-medium ${SCHEDULE_STATUS_COLORS[s]} ${
                      selected.status === s ? 'ring-2 ring-slate-800' : 'opacity-80 hover:opacity-100'
                    }`}
                  >
                    {SCHEDULE_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* История */}
          {selected.statusHistory.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-semibold uppercase text-slate-500">История</p>
              <ul className="space-y-1 text-xs text-slate-600">
                {selected.statusHistory.map((h, i) => (
                  <li key={i}>
                    <span className="text-slate-400">{new Date(h.at).toLocaleString('ru-RU')}</span> · {h.action}
                    {h.comment ? ` · ${h.comment}` : ''} · {h.byName ?? '—'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {canDelete && (
            <button
              onClick={() => handleDelete(selected)}
              className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              Удалить из графика
            </button>
          )}
        </div>
      )}

      {/* Модалка создания */}
      {showCreate && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-xl"
          >
            <h2 className="text-lg font-bold text-blue-800">Новая работа в график</h2>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Дата</span>
              <input type="date" required value={createForm.plannedDate}
                onChange={(e) => setCreateForm((f) => ({ ...f, plannedDate: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Объект</span>
              <select required value={createForm.objectId || ''}
                onChange={(e) => setCreateForm((f) => ({ ...f, objectId: Number(e.target.value) }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option value="">— выберите —</option>
                {objects.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Вид работы</span>
              <select value={createForm.workTypeId ?? ''}
                onChange={(e) => setCreateForm((f) => ({ ...f, workTypeId: e.target.value ? Number(e.target.value) : null }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option value="">— не выбран —</option>
                {workTypes.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Бригада</span>
              <select value={createForm.brigadeId ?? ''}
                onChange={(e) => setCreateForm((f) => ({ ...f, brigadeId: e.target.value ? Number(e.target.value) : null }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option value="">— не выбрана —</option>
                {brigades.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Исполнитель</span>
              <select value={createForm.assigneeUserId ?? ''}
                onChange={(e) => setCreateForm((f) => ({ ...f, assigneeUserId: e.target.value ? Number(e.target.value) : null }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option value="">— не выбран —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Комментарий</span>
              <textarea rows={2} value={createForm.comment ?? ''}
                onChange={(e) => setCreateForm((f) => ({ ...f, comment: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <div className="flex gap-2">
              <Button type="submit">Сохранить</Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Отмена</Button>
            </div>
          </form>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  )
}
