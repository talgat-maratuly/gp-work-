import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toUserMessage } from '@/api/client'
import { getNurseryName } from '@/lib/appConfig'
import {
  fetchDashboardSummary,
  type DashboardParams,
  type DashboardSummary,
} from '@/api/dashboardApi'
import { fetchDispatcher, type DispatcherData } from '@/api/operationsApi'
import { DispatcherMap } from '@/components/operations/DispatcherMap'

type Period = 'day' | 'week' | 'month'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'День' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
]

function KpiCard({
  label,
  value,
  hint,
  tone = 'default',
  onClick,
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'default' | 'blue' | 'green' | 'amber' | 'red'
  onClick?: () => void
}) {
  const toneClass = {
    default: 'text-slate-900',
    blue: 'text-blue-700',
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-red-700',
  }[tone]
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </button>
  )
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-1.5 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`text-sm font-bold ${tone ?? 'text-slate-900'}`}>{value}</span>
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<Period>('day')
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [dispatcher, setDispatcher] = useState<DispatcherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: DashboardParams = { period }
      const [summary, operations] = await Promise.all([
        fetchDashboardSummary(params),
        fetchDispatcher(),
      ])
      setData(summary)
      setDispatcher(operations)
    } catch (err) {
      setError(toUserMessage(err, 'Не удалось загрузить дашборд'))
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    load()
  }, [load])

  const go = (path: string) => () => navigate(path)
  const c = data?.cards

  return (
    <div className="space-y-5">
      {/* Заголовок */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">Дашборд</h1>
          <p className="text-sm text-slate-500">
            {getNurseryName()} · сводка по работам, поливу и графику
            {data && ` · ${data.filters.date}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  period === p.key ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            ⟳ Обновить
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Загрузка…</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
          <p>{error}</p>
          <button onClick={load} className="mt-2 text-sm text-blue-700 underline">Повторить</button>
        </div>
      ) : c ? (
        <>
          {/* KPI-карточки */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            <KpiCard label="Всего объектов" value={c.objectsTotal} onClick={go('/admin/objects')} />
            <KpiCard label="Общая площадь" value={c.totalAreaM2 ? `${c.totalAreaM2.toLocaleString('ru-RU')} м²` : '—'} onClick={go('/admin/objects')} />
            <KpiCard label="Задач сегодня" value={c.tasksToday} tone="blue" onClick={go('/admin/tasks')} />
            <KpiCard label="Выполнено задач" value={c.tasksDone} tone="green" onClick={go('/admin/tasks')} />
            <KpiCard label="Задач в работе" value={c.tasksInProgress} tone="blue" onClick={go('/admin/tasks')} />
            <KpiCard label="Просрочено" value={c.tasksOverdue} tone="red" onClick={go('/admin/tasks')} />
            <KpiCard label="Требует проверки" value={c.tasksNeedsReview} tone="amber" onClick={go('/admin/tasks')} />
            <KpiCard label="Плановые литры" value={c.wateringPlannedLiters} hint="полив" onClick={go('/admin/watering')} />
            <KpiCard label="Фактические литры" value={c.wateringActualLiters} hint="полив" tone="green" onClick={go('/admin/watering')} />
            <KpiCard label="Водовозов" value={c.waterCarriers} tone="blue" onClick={go('/admin/watering')} />
            <KpiCard label="Активные бригады" value={c.activeBrigades} onClick={go('/admin/brigades')} />
            <KpiCard label="% выполнения работ" value={`${c.workCompletionPercent}%`} tone="green" onClick={go('/admin/schedule')} />
            <KpiCard label="% прохождения проверки" value={`${c.reviewPassPercent}%`} tone="green" onClick={go('/admin/management?period=day')} />
            <KpiCard label="Объекты без полива" value={c.objectsWithoutConfirmedWatering} tone="amber" onClick={go('/admin/watering?status=NEEDS_REVIEW')} />
          </div>

          {dispatcher && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                <DispatcherMap data={dispatcher} />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between"><h2 className="font-black">Оперативная сводка</h2><button onClick={go('/admin/dispatcher')} className="text-xs font-bold text-emerald-800 underline">открыть диспетчерскую</button></div>
                <div className="mt-3"><Stat label="Вышло сотрудников" value={dispatcher.summary.checkedIn}/><Stat label="Опоздало" value={dispatcher.summary.late} tone="text-amber-700"/><Stat label="Активные бригады" value={dispatcher.summary.activeBrigades}/><Stat label="Техника на работах" value={dispatcher.summary.activeVehicles}/><Stat label="Задержки маршрутов" value={dispatcher.summary.overdueStops} tone="text-red-700"/><Stat label="Проблемные работы" value={dispatcher.summary.problems} tone="text-red-700"/></div>
                <p className="mt-4 text-xs text-slate-400">Последнее обновление: {new Date(dispatcher.generatedAt).toLocaleTimeString('ru-RU')}</p>
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Задачи сегодня */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-blue-900">Задачи сегодня</h2>
                <button onClick={go('/admin/tasks')} className="text-xs text-blue-700 underline">все задачи</button>
              </div>
              {data.tasksTodayList.length === 0 ? (
                <p className="text-sm text-slate-400">На сегодня задач нет</p>
              ) : (
                <ul className="max-h-64 space-y-1.5 overflow-y-auto">
                  {data.tasksTodayList.map((t) => (
                    <li key={t.id} className="flex items-center justify-between border-b border-slate-100 pb-1 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{t.description || `Задача #${t.id}`}</p>
                        <p className="text-xs text-slate-500">{t.objectName}{t.assigneeName ? ` · ${t.assigneeName}` : ''}</p>
                      </div>
                      <span className="text-xs text-slate-400">{t.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Ночной отчёт полива */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-blue-900">Ночной отчёт полива</h2>
                <button onClick={go('/admin/watering?shift=NIGHT')} className="text-xs text-blue-700 underline">полив</button>
              </div>
              <Stat label="Полито" value={data.nightWatering.polito} tone="text-emerald-700" />
              <Stat label="Не полито" value={data.nightWatering.notPolito} tone="text-amber-700" />
              <Stat label="Требует проверки" value={data.nightWatering.needsReview} tone="text-red-700" />
              <Stat label="Литры (факт)" value={data.nightWatering.liters} />
            </div>

            {/* Производственный план */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-blue-900">Производственный план</h2>
                <button onClick={go('/admin/schedule')} className="text-xs text-blue-700 underline">график</button>
              </div>
              <Stat label="Всего работ" value={data.productionPlan.total} />
              <Stat label="Запланировано" value={data.productionPlan.planned} tone="text-amber-700" />
              <Stat label="В работе" value={data.productionPlan.inProgress} tone="text-blue-700" />
              <Stat label="Выполнено" value={data.productionPlan.done} tone="text-emerald-700" />
            </div>

            {/* KPI */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-lg font-semibold text-blue-900">KPI</h2>
              <Stat label="QA задач" value={`${data.kpi.qaPass}%`} tone="text-emerald-700" />
              <Stat label="Выполнение полива" value={`${data.kpi.wateringExec}%`} tone="text-emerald-700" />
              <Stat label="Выполнение графика" value={`${data.kpi.scheduleExec}%`} tone="text-emerald-700" />
              <Stat label="Выполнение решений" value={`${data.kpi.decisionsExec}%`} tone="text-emerald-700" />
              <Stat label="Задачи с фото" value={`${data.kpi.tasksWithPhoto}%`} tone="text-emerald-700" />
            </div>

            {/* Исключения качества */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-lg font-semibold text-blue-900">Исключения качества</h2>
              {data.qualityExceptions.length === 0 ? (
                <p className="text-sm text-emerald-700">Исключений нет — всё чисто ✓</p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-y-auto">
                  {data.qualityExceptions.map((q, i) => (
                    <li key={i} className="rounded-lg bg-amber-50 px-3 py-1.5">
                      <p className="text-sm font-medium text-amber-900">{q.title}</p>
                      <p className="text-xs text-amber-700">{q.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Протоколы и контроль выполнения */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-blue-900">Протоколы и контроль выполнения</h2>
                <button onClick={go('/admin/management')} className="text-xs text-blue-700 underline">управление</button>
              </div>
              {data.protocols.length === 0 ? (
                <p className="text-sm text-slate-400">Решений нет</p>
              ) : (
                <ul className="max-h-64 space-y-1.5 overflow-y-auto">
                  {data.protocols.map((p) => (
                    <li key={p.id} className="border-b border-slate-100 pb-1 last:border-0">
                      <p className="text-sm font-medium text-slate-800">{p.title}</p>
                      <p className="text-xs text-slate-500">
                        {p.status}{p.dueDate ? ` · срок ${p.dueDate}` : ''}{p.responsible ? ` · ${p.responsible}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Исполнение и проверка */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-lg font-semibold text-blue-900">Исполнение и проверка</h2>
            {data.executionReview.length === 0 ? (
              <p className="text-sm text-slate-400">Нет задач за период</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">Задача</th>
                      <th className="py-2 pr-3">Объект</th>
                      <th className="py-2 pr-3">Вид</th>
                      <th className="py-2 pr-3">Исполнитель</th>
                      <th className="py-2 pr-3">Фото</th>
                      <th className="py-2">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.executionReview.map((t) => (
                      <tr key={t.taskId} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3 font-medium text-slate-800">{t.description || `#${t.taskId}`}</td>
                        <td className="py-2 pr-3">{t.objectName}</td>
                        <td className="py-2 pr-3">{t.workTypeName ?? '—'}</td>
                        <td className="py-2 pr-3">{t.assigneeName ?? '—'}</td>
                        <td className="py-2 pr-3">{t.photoCount}</td>
                        <td className="py-2">{t.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
