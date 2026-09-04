import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/Toast'
import { useAuth } from '@/context/AuthContext'
import { toUserMessage } from '@/api/client'
import { fetchObjectsWithSections, type NurseryObjectWithSections } from '@/api/objectsApi'
import { fetchUsers, type ApiUser } from '@/api/usersApi'
import {
  createWatering,
  deleteWatering,
  fetchWatering,
  fetchWateringStats,
  reviewWatering,
  WATERING_SHIFT_LABELS,
  WATERING_STATUS_LABELS,
  WATERING_TYPE_LABELS,
  type WateringFilters,
  type WateringPayload,
  type WateringRecord,
  type WateringShift,
  type WateringStatus,
  type WateringStats,
  type WateringType,
} from '@/api/wateringApi'
import { businessDateString } from '@/lib/businessDate'

const STATUS_BADGE: Record<WateringStatus, string> = {
  PLANNED: 'bg-slate-100 text-slate-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  DONE: 'bg-emerald-100 text-emerald-800',
  SKIPPED: 'bg-amber-100 text-amber-800',
  NEEDS_REVIEW: 'bg-red-100 text-red-800',
}

const STATUS_OPTIONS: WateringStatus[] = [
  'PLANNED',
  'IN_PROGRESS',
  'DONE',
  'SKIPPED',
  'NEEDS_REVIEW',
]

const emptyForm = (): WateringPayload => ({
  workDate: businessDateString(),
  shift: 'NIGHT',
  type: 'AUTO',
  objectId: null,
  sectionId: null,
  waterCarrierId: null,
  performerName: '',
  plannedLiters: null,
  actualLiters: null,
  startTime: '',
  endTime: '',
  comment: '',
})

function KpiCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'default' | 'blue' | 'green' | 'amber' | 'red'
}) {
  const toneClass =
    tone === 'blue'
      ? 'text-blue-700'
      : tone === 'green'
        ? 'text-emerald-700'
        : tone === 'amber'
          ? 'text-amber-700'
          : tone === 'red'
            ? 'text-red-700'
            : 'text-slate-900'
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

export function WateringPage() {
  const { hasRole } = useAuth()
  const canEdit = hasRole('DIRECTOR', 'ADMIN', 'BRIGADIER', 'AGRONOMIST', 'WATER_CARRIER')
  const canReview = hasRole('DIRECTOR', 'ADMIN', 'BRIGADIER', 'AGRONOMIST')
  const canDelete = hasRole('DIRECTOR', 'ADMIN')

  const [records, setRecords] = useState<WateringRecord[]>([])
  const [stats, setStats] = useState<WateringStats | null>(null)
  const [objects, setObjects] = useState<NurseryObjectWithSections[]>([])
  const [carriers, setCarriers] = useState<ApiUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState<WateringFilters>(() => {
    const f: WateringFilters = {}
    const status = searchParams.get('status')
    const shift = searchParams.get('shift')
    const date = searchParams.get('date')
    if (status) f.status = status as WateringStatus
    if (shift) f.shift = shift as WateringShift
    if (date) f.date = date
    return f
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<WateringPayload>(emptyForm())
  const [saving, setSaving] = useState(false)

  const sectionsForObject = useMemo(() => {
    const obj = objects.find((o) => o.id === form.objectId)
    return obj?.sections ?? []
  }, [objects, form.objectId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, statData] = await Promise.all([
        fetchWatering(filters),
        fetchWateringStats(filters),
      ])
      setRecords(list)
      setStats(statData)
    } catch (err) {
      setError(toUserMessage(err, 'Не удалось загрузить данные полива'))
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    // Справочники для формы — один раз
    fetchObjectsWithSections()
      .then(setObjects)
      .catch(() => setObjects([]))
    fetchUsers()
      .then((users) => setCarriers(users.filter((u) => u.role === 'WATER_CARRIER')))
      .catch(() => setCarriers([]))
  }, [])

  const patchFilter = (patch: Partial<WateringFilters>) =>
    setFilters((prev) => ({ ...prev, ...patch }))

  const patchForm = (patch: Partial<WateringPayload>) =>
    setForm((prev) => ({ ...prev, ...patch }))

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload: WateringPayload = {
        ...form,
        performerName: form.performerName?.trim() || undefined,
        comment: form.comment?.trim() || undefined,
        startTime: form.startTime?.trim() || undefined,
        endTime: form.endTime?.trim() || undefined,
        waterCarrierId: form.type === 'WATER_CARRIER' ? form.waterCarrierId ?? null : null,
      }
      await createWatering(payload)
      setToast('Полив сохранён')
      setForm(emptyForm())
      setShowForm(false)
      await load()
    } catch (err) {
      setToast(toUserMessage(err, 'Не удалось сохранить полив'))
    } finally {
      setSaving(false)
    }
  }

  async function handleReview(rec: WateringRecord, status: WateringStatus) {
    try {
      await reviewWatering(rec.id, { status })
      setToast('Статус обновлён')
      await load()
    } catch (err) {
      setToast(toUserMessage(err, 'Не удалось обновить статус'))
    }
  }

  async function handleDelete(rec: WateringRecord) {
    if (!window.confirm('Удалить запись полива?')) return
    try {
      await deleteWatering(rec.id)
      setToast('Запись удалена')
      await load()
    } catch (err) {
      setToast(toUserMessage(err, 'Не удалось удалить запись'))
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">Полив</h1>
          <p className="text-sm text-slate-500">
            Автоматический полив и полив водовозом · план и факт по литрам
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Скрыть форму' : '+ Добавить полив'}
          </Button>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Запланировано" value={stats?.planned ?? 0} />
        <KpiCard label="В процессе" value={stats?.inProgress ?? 0} tone="blue" />
        <KpiCard label="Полито" value={stats?.done ?? 0} tone="green" />
        <KpiCard label="Пропущено" value={stats?.skipped ?? 0} tone="amber" />
        <KpiCard label="Требует проверки" value={stats?.needsReview ?? 0} tone="red" />
        <KpiCard label="Литров план" value={stats?.plannedLiters ?? 0} hint="л" />
        <KpiCard label="Литров факт" value={stats?.actualLiters ?? 0} hint="л" tone="green" />
        <KpiCard
          label="Разница план/факт"
          value={stats?.litersDiff ?? 0}
          hint="л"
          tone={(stats?.litersDiff ?? 0) < 0 ? 'red' : 'default'}
        />
        <KpiCard
          label="Объекты без подтв."
          value={stats?.objectsWithoutConfirmed ?? 0}
          tone="amber"
        />
        <KpiCard label="Водовозов" value={stats?.waterCarrierCount ?? 0} tone="blue" />
      </div>

      {/* Форма создания */}
      {showForm && canEdit && (
        <form
          onSubmit={handleCreate}
          className="grid gap-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Дата</span>
            <input
              type="date"
              required
              value={form.workDate}
              onChange={(e) => patchForm({ workDate: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Смена</span>
            <select
              value={form.shift}
              onChange={(e) => patchForm({ shift: e.target.value as WateringShift })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
            >
              {(Object.keys(WATERING_SHIFT_LABELS) as WateringShift[]).map((s) => (
                <option key={s} value={s}>
                  {WATERING_SHIFT_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Тип полива</span>
            <select
              value={form.type}
              onChange={(e) => patchForm({ type: e.target.value as WateringType })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
            >
              {(Object.keys(WATERING_TYPE_LABELS) as WateringType[]).map((t) => (
                <option key={t} value={t}>
                  {WATERING_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Объект</span>
            <select
              value={form.objectId ?? ''}
              onChange={(e) =>
                patchForm({
                  objectId: e.target.value ? Number(e.target.value) : null,
                  sectionId: null,
                })
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
            >
              <option value="">— не выбран —</option>
              {objects.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Участок (QR)</span>
            <select
              value={form.sectionId ?? ''}
              onChange={(e) =>
                patchForm({ sectionId: e.target.value ? Number(e.target.value) : null })
              }
              disabled={!form.objectId}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 disabled:bg-slate-100"
            >
              <option value="">— не выбран —</option>
              {sectionsForObject.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </label>

          {form.type === 'WATER_CARRIER' && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Водовоз</span>
              <select
                value={form.waterCarrierId ?? ''}
                onChange={(e) =>
                  patchForm({ waterCarrierId: e.target.value ? Number(e.target.value) : null })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
              >
                <option value="">— не выбран —</option>
                {carriers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Водитель / исполнитель
            </span>
            <input
              value={form.performerName ?? ''}
              onChange={(e) => patchForm({ performerName: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Плановые литры</span>
            <input
              type="number"
              min={0}
              value={form.plannedLiters ?? ''}
              onChange={(e) =>
                patchForm({ plannedLiters: e.target.value ? Number(e.target.value) : null })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Фактические литры</span>
            <input
              type="number"
              min={0}
              value={form.actualLiters ?? ''}
              onChange={(e) =>
                patchForm({ actualLiters: e.target.value ? Number(e.target.value) : null })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Время начала</span>
            <input
              type="time"
              value={form.startTime ?? ''}
              onChange={(e) => patchForm({ startTime: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Время окончания</span>
            <input
              type="time"
              value={form.endTime ?? ''}
              onChange={(e) => patchForm({ endTime: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            />
          </label>

          <label className="block sm:col-span-2 lg:col-span-3">
            <span className="mb-1 block text-sm font-medium text-slate-700">Комментарий</span>
            <textarea
              rows={2}
              value={form.comment ?? ''}
              onChange={(e) => patchForm({ comment: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            />
          </label>

          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить полив'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Отмена
            </Button>
          </div>
        </form>
      )}

      {/* Фильтры */}
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-3 lg:grid-cols-6">
        <input
          type="date"
          value={filters.date ?? ''}
          onChange={(e) => patchFilter({ date: e.target.value || undefined })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={filters.shift ?? ''}
          onChange={(e) => patchFilter({ shift: (e.target.value || undefined) as WateringShift })}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Все смены</option>
          {(Object.keys(WATERING_SHIFT_LABELS) as WateringShift[]).map((s) => (
            <option key={s} value={s}>
              {WATERING_SHIFT_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={filters.status ?? ''}
          onChange={(e) => patchFilter({ status: (e.target.value || undefined) as WateringStatus })}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Все статусы</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {WATERING_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={filters.type ?? ''}
          onChange={(e) => patchFilter({ type: (e.target.value || undefined) as WateringType })}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Все типы</option>
          {(Object.keys(WATERING_TYPE_LABELS) as WateringType[]).map((t) => (
            <option key={t} value={t}>
              {WATERING_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={filters.objectId ?? ''}
          onChange={(e) =>
            patchFilter({ objectId: e.target.value ? Number(e.target.value) : undefined })
          }
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Все объекты</option>
          {objects.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Поиск: объект, исполнитель…"
          value={filters.search ?? ''}
          onChange={(e) => patchFilter({ search: e.target.value || undefined })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {/* Таблица */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Загрузка…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
          <p>{error}</p>
          <button onClick={load} className="mt-2 text-sm text-blue-700 underline">
            Повторить
          </button>
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Записей полива нет. Добавьте первый полив кнопкой выше.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Дата</th>
                <th className="px-3 py-2">Смена</th>
                <th className="px-3 py-2">Объект / участок</th>
                <th className="px-3 py-2">Исполнитель</th>
                <th className="px-3 py-2">Тип</th>
                <th className="px-3 py-2">Статус</th>
                <th className="px-3 py-2 text-right">План л</th>
                <th className="px-3 py-2 text-right">Факт л</th>
                <th className="px-3 py-2">Время</th>
                <th className="px-3 py-2">Гео / QR</th>
                <th className="px-3 py-2">Действия</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2">{r.workDate}</td>
                  <td className="px-3 py-2">{WATERING_SHIFT_LABELS[r.shift]}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{r.objectName ?? '—'}</div>
                    {r.sectionName && (
                      <div className="text-xs text-slate-400">
                        {r.sectionName} {r.sectionCode ? `(${r.sectionCode})` : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.waterCarrier?.fullName ?? r.performerName ?? '—'}
                  </td>
                  <td className="px-3 py-2">{WATERING_TYPE_LABELS[r.type]}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status]}`}
                    >
                      {WATERING_STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{r.plannedLiters ?? '—'}</td>
                  <td className="px-3 py-2 text-right">{r.actualLiters ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">
                    {r.startTime || '—'}
                    {r.endTime ? ` – ${r.endTime}` : ''}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.latitude != null && r.longitude != null ? (
                      <a
                        href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 underline"
                      >
                        гео
                      </a>
                    ) : (
                      <span className="text-slate-400">нет гео</span>
                    )}
                    {r.qrConfirmed && <span className="ml-1 text-emerald-700">QR✓</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {canReview && r.status !== 'DONE' && (
                        <button
                          onClick={() => handleReview(r, 'DONE')}
                          className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-200"
                        >
                          Подтвердить
                        </button>
                      )}
                      {canReview && r.status !== 'NEEDS_REVIEW' && (
                        <button
                          onClick={() => handleReview(r, 'NEEDS_REVIEW')}
                          className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200"
                        >
                          На проверку
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(r)}
                          className="rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
