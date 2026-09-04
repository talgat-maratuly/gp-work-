import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/Toast'
import { useAuth } from '@/context/AuthContext'
import { businessDateString } from '@/lib/businessDate'
import { toUserMessage } from '@/api/client'
import { fetchAssignableUsers, type ApiAssignee } from '@/api/usersApi'
import {
  createDecision,
  deleteDecision,
  DECISION_PRIORITY_LABELS,
  DECISION_STATUS_LABELS,
  fetchDecisions,
  fetchOverview,
  updateDecision,
  type Decision,
  type DecisionPayload,
  type DecisionPriority,
  type DecisionStatus,
  type ManagementOverview,
} from '@/api/managementApi'

type Period = 'day' | 'week' | 'month'

const PERIOD_TABS: { key: Period; label: string }[] = [
  { key: 'day', label: 'Ежедневная оперативка' },
  { key: 'week', label: 'Еженедельная планёрка' },
  { key: 'month', label: 'Месячные итоги' },
]

const DECISION_STATUS_BADGE: Record<DecisionStatus, string> = {
  OPEN: 'bg-slate-100 text-slate-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  ROUTED_TO_TASK: 'bg-violet-100 text-violet-800',
  DONE: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

function Kpi({ label, value, target }: { label: string; value: number; target?: number }) {
  const ok = target ? value >= target : true
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>
        {value}%
      </p>
      {target && <p className="mt-0.5 text-xs text-slate-400">цель {target}%</p>}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-1.5 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`text-sm font-bold ${tone ?? 'text-slate-900'}`}>{value}</span>
    </div>
  )
}

const emptyDecision = (): DecisionPayload => ({
  title: '',
  description: '',
  priority: 'MEDIUM',
  status: 'OPEN',
})

export function ManagementPage() {
  const { hasRole } = useAuth()
  const canManage = hasRole('DIRECTOR', 'ADMIN')

  const [searchParams] = useSearchParams()
  const [period, setPeriod] = useState<Period>(() => {
    const p = searchParams.get('period')
    return p === 'week' || p === 'month' ? p : 'day'
  })
  const [date, setDate] = useState(() => searchParams.get('date') || businessDateString())
  const [overview, setOverview] = useState<ManagementOverview | null>(null)
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [users, setUsers] = useState<ApiAssignee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<DecisionPayload>(emptyDecision())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ov, dec] = await Promise.all([fetchOverview(period, date), fetchDecisions()])
      setOverview(ov)
      setDecisions(dec)
    } catch (err) {
      setError(toUserMessage(err, 'Не удалось загрузить данные'))
    } finally {
      setLoading(false)
    }
  }, [date, period])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    fetchAssignableUsers().then(setUsers).catch(() => setUsers([]))
  }, [])

  const patchForm = (patch: Partial<DecisionPayload>) =>
    setForm((prev) => ({ ...prev, ...patch }))

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      setToast('Введите название решения')
      return
    }
    try {
      await createDecision({
        ...form,
        description: form.description?.trim() || undefined,
        comment: form.comment?.trim() || undefined,
      })
      setToast('Решение создано')
      setForm(emptyDecision())
      setShowForm(false)
      await load()
    } catch (err) {
      setToast(toUserMessage(err, 'Не удалось создать решение'))
    }
  }

  async function handleDecisionStatus(d: Decision, status: DecisionStatus) {
    try {
      await updateDecision(d.id, { status })
      setToast('Статус обновлён')
      await load()
    } catch (err) {
      setToast(toUserMessage(err, 'Не удалось обновить'))
    }
  }

  async function handleDeleteDecision(d: Decision) {
    if (!window.confirm('Удалить решение?')) return
    try {
      await deleteDecision(d.id)
      setToast('Удалено')
      await load()
    } catch (err) {
      setToast(toUserMessage(err, 'Не удалось удалить'))
    }
  }

  const userName = (id: number | null) =>
    users.find((u) => u.id === id)?.fullName ?? null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-blue-800">Управление</h1>
        <p className="text-sm text-slate-500">
          Оперативный контроль · KPI · решения и сроки
          {overview && ` · ${overview.range.from} — ${overview.range.to}`}
        </p>
      </div>

      {/* Вкладки-периоды */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
        <label className="sr-only" htmlFor="management-date">Дата отчёта</label>
        <input
          id="management-date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {PERIOD_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setPeriod(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              period === t.key ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Загрузка…</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
          <p>{error}</p>
          <button onClick={load} className="mt-2 text-sm text-blue-700 underline">Повторить</button>
        </div>
      ) : overview ? (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Kpi label="QA задач" value={overview.kpi.qaPass} target={90} />
            <Kpi label="Выполнение полива" value={overview.kpi.wateringExec} target={95} />
            <Kpi label="Выполнение графика" value={overview.kpi.scheduleExec} target={90} />
            <Kpi label="Выполнение решений" value={overview.kpi.decisionsExec} target={90} />
            <Kpi label="Задачи с фото" value={overview.kpi.tasksWithPhoto} target={90} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Ежедневный отчёт */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-lg font-semibold text-blue-900">Ежедневный отчёт</h2>
              <Stat label="Задач всего" value={overview.dailyReport.tasksTotal} />
              <Stat label="Закрыто" value={overview.dailyReport.closed} tone="text-emerald-700" />
              <Stat label="В работе" value={overview.dailyReport.inProgress} tone="text-blue-700" />
              <Stat label="Просрочено" value={overview.dailyReport.overdue} tone="text-red-700" />
              <Stat label="Требует проверки" value={overview.dailyReport.needsReview} tone="text-amber-700" />
              <Stat label="Объекты без фото" value={overview.dailyReport.objectsWithoutPhoto} tone="text-amber-700" />
              <Stat label="Полив без факт. литров" value={overview.dailyReport.wateringWithoutActual} tone="text-amber-700" />
            </div>

            {/* Полив + график */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-lg font-semibold text-blue-900">Полив и график</h2>
              <Stat label="Поливов всего" value={overview.watering.total} />
              <Stat label="Полито" value={overview.watering.done} tone="text-emerald-700" />
              <Stat label="Литров план" value={overview.watering.plannedLiters} />
              <Stat label="Литров факт" value={overview.watering.actualLiters} tone="text-emerald-700" />
              <Stat label="Разница план/факт" value={overview.watering.litersDiff} tone={overview.watering.litersDiff < 0 ? 'text-red-700' : 'text-slate-900'} />
              <Stat label="Работ в графике" value={overview.schedule.total} />
              <Stat label="Выполнено по графику" value={overview.schedule.done} tone="text-emerald-700" />
            </div>

            {/* Исполнение и проверка */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-lg font-semibold text-blue-900">Исполнение и проверка</h2>
              {overview.executionReview.length === 0 ? (
                <p className="text-sm text-slate-400">Нет задач за период</p>
              ) : (
                <ul className="max-h-72 space-y-2 overflow-y-auto">
                  {overview.executionReview.map((t) => (
                    <li key={t.taskId} className="border-b border-slate-100 pb-2 last:border-0">
                      <p className="text-sm font-medium text-slate-800">{t.description || `Задача #${t.taskId}`}</p>
                      <p className="text-xs text-slate-500">
                        {t.objectName} · {t.workTypeName ?? '—'} · {t.assigneeName ?? '—'}
                        {t.brigadeName ? ` · ${t.brigadeName}` : ''} · фото {t.photoCount} · {t.status}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Исключения качества */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-lg font-semibold text-blue-900">Исключения качества</h2>
              {overview.qualityExceptions.length === 0 ? (
                <p className="text-sm text-emerald-700">Исключений нет — всё чисто ✓</p>
              ) : (
                <ul className="max-h-72 space-y-2 overflow-y-auto">
                  {overview.qualityExceptions.map((q, i) => (
                    <li key={i} className="rounded-lg bg-amber-50 px-3 py-1.5">
                      <p className="text-sm font-medium text-amber-900">{q.title}</p>
                      <p className="text-xs text-amber-700">{q.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Решения и сроки */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-blue-900">Решения и сроки</h2>
              {canManage && (
                <Button onClick={() => setShowForm((v) => !v)}>
                  {showForm ? 'Скрыть' : '+ Создать решение'}
                </Button>
              )}
            </div>

            {showForm && canManage && (
              <form onSubmit={handleCreate} className="mb-4 grid gap-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Название решения</span>
                  <input required value={form.title} onChange={(e) => patchForm({ title: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Описание</span>
                  <textarea rows={2} value={form.description ?? ''} onChange={(e) => patchForm({ description: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Ответственный</span>
                  <select value={form.responsibleUserId ?? ''} onChange={(e) => patchForm({ responsibleUserId: e.target.value ? Number(e.target.value) : null })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                    <option value="">— не выбран —</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Срок</span>
                  <input type="date" value={form.dueDate ?? ''} onChange={(e) => patchForm({ dueDate: e.target.value || null })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Приоритет</span>
                  <select value={form.priority} onChange={(e) => patchForm({ priority: e.target.value as DecisionPriority })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                    {(Object.keys(DECISION_PRIORITY_LABELS) as DecisionPriority[]).map((p) => (
                      <option key={p} value={p}>{DECISION_PRIORITY_LABELS[p]}</option>
                    ))}
                  </select>
                </label>
                <div className="sm:col-span-2">
                  <Button type="submit">Сохранить решение</Button>
                </div>
              </form>
            )}

            {decisions.length === 0 ? (
              <p className="text-sm text-slate-400">Решений пока нет</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">Решение</th>
                      <th className="py-2 pr-3">Ответственный</th>
                      <th className="py-2 pr-3">Срок</th>
                      <th className="py-2 pr-3">Приоритет</th>
                      <th className="py-2 pr-3">Статус</th>
                      {canManage && <th className="py-2">Действия</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {decisions.map((d) => (
                      <tr key={d.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3 font-medium text-slate-800">{d.title}</td>
                        <td className="py-2 pr-3">{d.responsible?.fullName ?? userName(d.responsibleUserId) ?? '—'}</td>
                        <td className="whitespace-nowrap py-2 pr-3">{d.dueDate ?? '—'}</td>
                        <td className="py-2 pr-3">{DECISION_PRIORITY_LABELS[d.priority]}</td>
                        <td className="py-2 pr-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${DECISION_STATUS_BADGE[d.status]}`}>
                            {DECISION_STATUS_LABELS[d.status]}
                          </span>
                        </td>
                        {canManage && (
                          <td className="py-2">
                            <div className="flex flex-wrap items-center gap-1">
                              <select
                                value={d.status}
                                onChange={(e) => handleDecisionStatus(d, e.target.value as DecisionStatus)}
                                className="rounded border border-slate-300 px-1 py-1 text-xs"
                              >
                                {(Object.keys(DECISION_STATUS_LABELS) as DecisionStatus[]).map((s) => (
                                  <option key={s} value={s}>{DECISION_STATUS_LABELS[s]}</option>
                                ))}
                              </select>
                              <button onClick={() => handleDeleteDecision(d)}
                                className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100">
                                Удалить
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
