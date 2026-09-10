import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/Toast'
import { useAuth } from '@/context/AuthContext'
import { toUserMessage } from '@/api/client'
import { fetchUsers, type ApiUser } from '@/api/usersApi'
import {
  ADMIN_REPORT_STATUS_LABELS,
  createAdminReport,
  deleteAdminReport,
  fetchAdminReports,
  fetchReportAggregate,
  reviewAdminReport,
  submitAdminReport,
  updateAdminReport,
  type AdminReport,
  type AdminReportAggregate,
  type AdminReportFilters,
  type AdminReportPayload,
  type AdminReportStatus,
} from '@/api/adminReportsApi'
import { businessDateString } from '@/lib/businessDate'

const STATUS_BADGE: Record<AdminReportStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  FORMED: 'bg-blue-100 text-blue-800',
  IN_REVIEW: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  RETURNED: 'bg-red-100 text-red-800',
}

const TEXT_FIELDS: { key: keyof AdminReportPayload; label: string }[] = [
  { key: 'completedWorks', label: 'Выполненные работы' },
  { key: 'pendingWorks', label: 'Невыполненные работы' },
  { key: 'tasksInProgress', label: 'Задачи в работе' },
  { key: 'overdueTasks', label: 'Просроченные задачи' },
  { key: 'wateringDone', label: 'Проведённый полив' },
  { key: 'issues', label: 'Проблемы и замечания' },
  { key: 'attentionObjects', label: 'Объекты, требующие внимания' },
  { key: 'brigadesInfo', label: 'Информация по бригадам' },
  { key: 'waterCarriersInfo', label: 'Информация по водовозам' },
  { key: 'decisions', label: 'Необходимые решения' },
  { key: 'comment', label: 'Общий комментарий' },
]

const emptyForm = (): AdminReportPayload => ({
  reportDate: businessDateString(),
  completedWorks: '',
  pendingWorks: '',
  tasksInProgress: '',
  overdueTasks: '',
  wateringDone: '',
  issues: '',
  attentionObjects: '',
  brigadesInfo: '',
  waterCarriersInfo: '',
  decisions: '',
  comment: '',
  plannedLiters: null,
  actualLiters: null,
})

function StatusBadge({ status }: { status: AdminReportStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}
    >
      {ADMIN_REPORT_STATUS_LABELS[status]}
    </span>
  )
}

function printReport(rep: AdminReport) {
  const rows = TEXT_FIELDS.map((f) => {
    const value = (rep[f.key as keyof AdminReport] as string | null) ?? ''
    return value ? `<h3>${f.label}</h3><p>${String(value).replace(/\n/g, '<br>')}</p>` : ''
  }).join('')
  const w = window.open('', '_blank', 'width=800,height=900')
  if (!w) return
  w.document.write(`
    <html><head><title>Ежедневный отчёт ${rep.reportDate}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:24px;color:#0f172a;max-width:760px;margin:0 auto}
      h1{font-size:20px;margin:0 0 4px} h3{font-size:14px;margin:14px 0 2px;color:#1d4ed8}
      p{margin:0;font-size:13px;line-height:1.5;white-space:pre-wrap}
      .meta{color:#64748b;font-size:12px;margin-bottom:12px}
      .liters{margin-top:10px;font-size:13px}
    </style></head><body>
    <h1>Ежедневный отчёт администратора</h1>
    <div class="meta">Дата: ${rep.reportDate} · Автор: ${rep.author?.fullName ?? '—'} · Статус: ${ADMIN_REPORT_STATUS_LABELS[rep.status]}</div>
    <div class="liters">Плановые литры: <b>${rep.plannedLiters ?? '—'}</b> · Фактические литры: <b>${rep.actualLiters ?? '—'}</b></div>
    ${rows}
    </body></html>`)
  w.document.close()
  w.focus()
  w.print()
}

export function AdminReportsPage() {
  const { hasRole } = useAuth()
  const canEdit = hasRole('DIRECTOR', 'ADMIN')
  // Подтверждает/возвращает отчёт только Директор (админ создаёт и отправляет).
  const canReview = hasRole('DIRECTOR')

  const [reports, setReports] = useState<AdminReport[]>([])
  const [authors, setAuthors] = useState<ApiUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [filters, setFilters] = useState<AdminReportFilters>({})
  const [mode, setMode] = useState<'list' | 'edit' | 'view'>('list')
  const [form, setForm] = useState<AdminReportPayload>(emptyForm())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [viewing, setViewing] = useState<AdminReport | null>(null)
  const [aggregate, setAggregate] = useState<AdminReportAggregate | null>(null)
  const [saving, setSaving] = useState(false)
  const [detailed, setDetailed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setReports(await fetchAdminReports(filters))
    } catch (err) {
      setError(toUserMessage(err, 'Не удалось загрузить отчёты'))
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    fetchUsers()
      .then((u) => setAuthors(u.filter((x) => x.role === 'ADMIN' || x.role === 'DIRECTOR')))
      .catch(() => setAuthors([]))
  }, [])

  // Авто-сводка из задач/полива/табеля за дату отчёта
  useEffect(() => {
    if (mode !== 'edit' || !form.reportDate) {
      return
    }
    let cancelled = false
    fetchReportAggregate(form.reportDate)
      .then((a) => !cancelled && setAggregate(a))
      .catch(() => !cancelled && setAggregate(null))
    return () => {
      cancelled = true
    }
  }, [mode, form.reportDate])

  const patchForm = (patch: Partial<AdminReportPayload>) =>
    setForm((prev) => ({ ...prev, ...patch }))

  const patchFilter = (patch: Partial<AdminReportFilters>) =>
    setFilters((prev) => ({ ...prev, ...patch }))

  function startCreate() {
    setForm(emptyForm())
    setEditingId(null)
    setAggregate(null)
    setMode('edit')
  }

  function startEdit(rep: AdminReport) {
    setForm({
      reportDate: rep.reportDate,
      completedWorks: rep.completedWorks ?? '',
      pendingWorks: rep.pendingWorks ?? '',
      tasksInProgress: rep.tasksInProgress ?? '',
      overdueTasks: rep.overdueTasks ?? '',
      wateringDone: rep.wateringDone ?? '',
      issues: rep.issues ?? '',
      attentionObjects: rep.attentionObjects ?? '',
      brigadesInfo: rep.brigadesInfo ?? '',
      waterCarriersInfo: rep.waterCarriersInfo ?? '',
      decisions: rep.decisions ?? '',
      comment: rep.comment ?? '',
      plannedLiters: rep.plannedLiters,
      actualLiters: rep.actualLiters,
    })
    setEditingId(rep.id)
    setMode('edit')
  }

  function applyAggregateLiters() {
    if (!aggregate) return
    patchForm({
      plannedLiters: aggregate.watering.plannedLiters,
      actualLiters: aggregate.watering.actualLiters,
    })
    setToast('Литры подставлены из данных полива')
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingId) {
        await updateAdminReport(editingId, form)
        setToast('Отчёт сохранён')
      } else {
        await createAdminReport(form)
        setToast('Черновик создан')
      }
      setMode('list')
      await load()
    } catch (err) {
      setToast(toUserMessage(err, 'Не удалось сохранить отчёт'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitToReview(rep: AdminReport) {
    try {
      await submitAdminReport(rep.id)
      setToast('Отчёт отправлен на проверку')
      await refreshView(rep.id)
      await load()
    } catch (err) {
      setToast(toUserMessage(err, 'Не удалось отправить'))
    }
  }

  async function handleReview(rep: AdminReport, status: 'APPROVED' | 'RETURNED') {
    try {
      const comment =
        status === 'RETURNED'
          ? window.prompt('Комментарий для возврата на доработку (необязательно):') ?? undefined
          : undefined
      await reviewAdminReport(rep.id, { status, reviewComment: comment })
      setToast(status === 'APPROVED' ? 'Отчёт подтверждён' : 'Отчёт возвращён на доработку')
      await refreshView(rep.id)
      await load()
    } catch (err) {
      setToast(toUserMessage(err, 'Не удалось изменить статус'))
    }
  }

  async function handleDelete(rep: AdminReport) {
    if (!window.confirm('Удалить отчёт?')) return
    try {
      await deleteAdminReport(rep.id)
      setToast('Отчёт удалён')
      setMode('list')
      await load()
    } catch (err) {
      setToast(toUserMessage(err, 'Не удалось удалить'))
    }
  }

  async function refreshView(id: number) {
    try {
      const fresh = (await fetchAdminReports(filters)).find((r) => r.id === id)
      if (fresh && mode === 'view') setViewing(fresh)
    } catch {
      /* ignore */
    }
  }

  function openView(rep: AdminReport) {
    setViewing(rep)
    setMode('view')
  }

  const authorName = useCallback(
    (id: number | null) => authors.find((a) => a.id === id)?.fullName ?? null,
    [authors],
  )

  // ---- РЕЖИМ: РЕДАКТИРОВАНИЕ / СОЗДАНИЕ ----
  if (mode === 'edit') {
    return (
      <form onSubmit={handleSave} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-blue-800">
            {editingId ? 'Редактирование отчёта' : 'Новый ежедневный отчёт'}
          </h1>
          <Button type="button" variant="ghost" onClick={() => setMode('list')}>
            ← К списку
          </Button>
        </div>

        <label className="block max-w-xs">
          <span className="mb-1 block text-sm font-medium text-slate-700">Дата отчёта</span>
          <input
            type="date"
            required
            value={form.reportDate}
            onChange={(e) => patchForm({ reportDate: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          />
        </label>

        {/* Авто-сводка */}
        {aggregate && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-blue-900">
                Авто-данные за {aggregate.date} (из задач, полива, табеля)
              </p>
              <button
                type="button"
                onClick={applyAggregateLiters}
                className="text-xs text-blue-700 underline"
              >
                Подставить литры
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div>Задач сегодня: <b>{aggregate.tasksToday}</b></div>
              <div>Закрыто: <b>{aggregate.closed}</b></div>
              <div>В работе: <b>{aggregate.inProgress}</b></div>
              <div>Требует проверки: <b>{aggregate.needsReview}</b></div>
              <div>Просрочено: <b>{aggregate.overdue}</b></div>
              <div>На объектах (табель): <b>{aggregate.attendanceCount}</b></div>
              <div>Полив — план л: <b>{aggregate.watering.plannedLiters}</b></div>
              <div>Полив — факт л: <b>{aggregate.watering.actualLiters}</b></div>
            </div>
          </div>
        )}

        {/* Основной вариант — весь отчёт одним текстом */}
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Текст отчёта <span className="font-normal text-slate-400">(можно записать всё одним текстом)</span>
          </span>
          <textarea
            rows={7}
            value={form.comment ?? ''}
            onChange={(e) => patchForm({ comment: e.target.value })}
            placeholder="Опишите день свободным текстом: выполненные и невыполненные работы, полив, проблемы, объекты, решения…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <button
          type="button"
          onClick={() => setDetailed((v) => !v)}
          className="text-sm text-blue-700 underline"
        >
          {detailed ? 'Скрыть подробные разделы' : 'Заполнить по разделам (необязательно)'}
        </button>

        {detailed && (
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
            {TEXT_FIELDS.filter((f) => f.key !== 'comment').map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">{f.label}</span>
                <textarea
                  rows={2}
                  value={(form[f.key] as string) ?? ''}
                  onChange={(e) => patchForm({ [f.key]: e.target.value } as Partial<AdminReportPayload>)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
            ))}

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Плановые литры</span>
              <input
                type="number"
                min={0}
                value={form.plannedLiters ?? ''}
                onChange={(e) =>
                  patchForm({ plannedLiters: e.target.value ? Number(e.target.value) : null })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? 'Сохранение…' : editingId ? 'Сохранить' : 'Сохранить черновик'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setMode('list')}>
            Отмена
          </Button>
        </div>
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </form>
    )
  }

  // ---- РЕЖИМ: ПРОСМОТР ----
  if (mode === 'view' && viewing) {
    const rep = viewing
    const editable = rep.status === 'DRAFT' || rep.status === 'RETURNED'
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-blue-800">Отчёт за {rep.reportDate}</h1>
            <p className="text-sm text-slate-500">
              Автор: {rep.author?.fullName ?? '—'} · <StatusBadge status={rep.status} />
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={() => setMode('list')}>
            ← К списку
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {canEdit && editable && (
            <Button onClick={() => startEdit(rep)}>Редактировать</Button>
          )}
          {canEdit && editable && (
            <Button variant="secondary" onClick={() => handleSubmitToReview(rep)}>
              Отправить на проверку
            </Button>
          )}
          {canReview && rep.status === 'IN_REVIEW' && (
            <>
              <Button onClick={() => handleReview(rep, 'APPROVED')}>Подтвердить</Button>
              <Button variant="danger" onClick={() => handleReview(rep, 'RETURNED')}>
                Вернуть на доработку
              </Button>
            </>
          )}
          <Button variant="secondary" onClick={() => printReport(rep)}>
            Печать
          </Button>
          {canEdit && (
            <Button variant="danger" onClick={() => handleDelete(rep)}>
              Удалить
            </Button>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 text-sm">
            Плановые литры: <b>{rep.plannedLiters ?? '—'}</b> · Фактические литры:{' '}
            <b>{rep.actualLiters ?? '—'}</b>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            {TEXT_FIELDS.map((f) => {
              const value = rep[f.key as keyof AdminReport] as string | null
              if (!value) return null
              return (
                <div key={f.key}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {f.label}
                  </dt>
                  <dd className="whitespace-pre-wrap text-sm text-slate-800">{value}</dd>
                </div>
              )
            })}
          </dl>
          {rep.reviewComment && (
            <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
              Комментарий проверяющего: {rep.reviewComment}
            </p>
          )}
        </div>

        {/* История изменений */}
        {rep.statusHistory.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-sm font-semibold text-slate-700">История изменений</p>
            <ul className="space-y-1 text-sm text-slate-600">
              {rep.statusHistory.map((h, i) => (
                <li key={i}>
                  <span className="text-slate-400">{new Date(h.at).toLocaleString('ru-RU')}</span>{' '}
                  · {ADMIN_REPORT_STATUS_LABELS[h.status]} · {h.byName ?? '—'}
                  {h.comment ? ` · ${h.comment}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </div>
    )
  }

  // ---- РЕЖИМ: СПИСОК ----
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">Ежедневный отчёт администратора</h1>
          <p className="text-sm text-slate-500">
            Ежедневные отчёты по дням · черновик → на проверку → подтверждение
          </p>
        </div>
        {canEdit && <Button onClick={startCreate}>+ Создать ежедневный отчёт</Button>}
      </div>

      {/* Фильтры */}
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-4">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">Период с</span>
          <input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => patchFilter({ dateFrom: e.target.value || undefined })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">по</span>
          <input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => patchFilter({ dateTo: e.target.value || undefined })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">Автор</span>
          <select
            value={filters.authorId ?? ''}
            onChange={(e) =>
              patchFilter({ authorId: e.target.value ? Number(e.target.value) : undefined })
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Все авторы</option>
            {authors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">Статус</span>
          <select
            value={filters.status ?? ''}
            onChange={(e) =>
              patchFilter({ status: (e.target.value || undefined) as AdminReportStatus })
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Все статусы</option>
            {(Object.keys(ADMIN_REPORT_STATUS_LABELS) as AdminReportStatus[]).map((s) => (
              <option key={s} value={s}>
                {ADMIN_REPORT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

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
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Отчётов пока нет.{canEdit ? ' Создайте первый кнопкой выше.' : ''}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Дата</th>
                <th className="px-3 py-2">Автор</th>
                <th className="px-3 py-2">Статус</th>
                <th className="px-3 py-2">Обновлён</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-800">
                    {r.reportDate}
                  </td>
                  <td className="px-3 py-2">{r.author?.fullName ?? authorName(r.authorId) ?? '—'}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">
                    {new Date(r.updatedAt).toLocaleString('ru-RU')}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => openView(r)}
                      className="text-sm text-blue-700 underline"
                    >
                      Открыть
                    </button>
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
