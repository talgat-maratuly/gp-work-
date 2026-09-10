import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchFieldToday, fetchMyRoute, startRoute, type FieldRoute, type FieldTask } from '@/api/fieldApi'
import { toUserMessage } from '@/api/client'
import { FieldStatus } from '@/components/field/FieldStatus'

export function FieldTodayPage() {
  const [tasks, setTasks] = useState<FieldTask[]>([])
  const [route, setRoute] = useState<FieldRoute | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [today, currentRoute] = await Promise.all([fetchFieldToday(), fetchMyRoute()])
      setTasks(today.tasks)
      setRoute(currentRoute)
    } catch (err) {
      setError(toUserMessage(err, 'Не удалось загрузить рабочий день'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  const next = useMemo(() => tasks.find((task) => task.execution?.status !== 'ACCEPTED') ?? tasks[0], [tasks])

  if (loading) return <p className="py-16 text-center text-slate-500">Загружаем рабочий день…</p>
  if (error) return <div className="rounded-2xl bg-red-50 p-4 text-red-800"><p>{error}</p><button onClick={load} className="mt-3 font-semibold underline">Повторить</button></div>

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-gradient-to-br from-emerald-700 to-emerald-900 p-5 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div><p className="text-sm text-emerald-100">Сегодня</p><p className="mt-1 text-3xl font-black">{tasks.length} задач</p></div>
          <div className="rounded-2xl bg-white/15 px-3 py-2 text-center"><p className="text-xl font-bold">{route?.stops.length ?? 0}</p><p className="text-[10px]">точек</p></div>
        </div>
        {route?.status === 'PLANNED' && (
          <button onClick={async () => { await startRoute(route.id); await load() }} className="mt-5 w-full rounded-xl bg-white py-3 font-bold text-emerald-800">Начать маршрут</button>
        )}
        {route?.status === 'IN_PROGRESS' && <p className="mt-4 rounded-xl bg-white/15 px-3 py-2 text-sm">Маршрут выполняется</p>}
      </section>

      {next ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Следующая задача</p>{next.execution && <FieldStatus status={next.execution.status} />}</div>
          <h1 className="mt-3 text-xl font-bold text-slate-900">{next.description || next.workType?.name || `Задача #${next.id}`}</h1>
          <p className="mt-2 font-semibold text-emerald-800">{next.section.object?.name}</p>
          <p className="text-sm text-slate-500">{next.section.name} · {next.section.code}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link to={`/field/qr?taskId=${next.id}`} className="rounded-xl bg-emerald-700 px-4 py-3 text-center font-bold text-white">Открыть QR</Link>
            <Link to={`/field/tasks/${next.id}`} className="rounded-xl border border-slate-300 px-4 py-3 text-center font-semibold text-slate-700">Открыть задачу</Link>
          </div>
        </section>
      ) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">На сегодня задач нет</div>}

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white p-3 shadow-sm"><p className="text-2xl font-bold">{tasks.filter((t) => t.execution?.status === 'ACCEPTED').length}</p><p className="text-xs text-slate-500">Принято</p></div>
        <div className="rounded-xl bg-white p-3 shadow-sm"><p className="text-2xl font-bold">{tasks.filter((t) => ['STARTED', 'IN_PROGRESS'].includes(t.execution?.status ?? '')).length}</p><p className="text-xs text-slate-500">В работе</p></div>
        <div className="rounded-xl bg-white p-3 shadow-sm"><p className="text-2xl font-bold">{tasks.filter((t) => t.execution?.status === 'REJECTED').length}</p><p className="text-xs text-slate-500">Проблемы</p></div>
      </div>
    </div>
  )
}
