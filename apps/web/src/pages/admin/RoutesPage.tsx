import { FormEvent, useEffect, useMemo, useState } from 'react'
import { fetchBrigades, type ApiBrigade } from '@/api/brigadesApi'
import { createRoute, fetchRoutes, type FieldRoute } from '@/api/fieldApi'
import { fetchTasks, type ApiTask } from '@/api/tasksApi'
import { toUserMessage } from '@/api/client'
import { businessDateString } from '@/lib/businessDate'
import { useAuth } from '@/context/AuthContext'

export function RoutesPage() {
  const { user } = useAuth()
  const [date, setDate] = useState(businessDateString)
  const [brigadeId, setBrigadeId] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [routes, setRoutes] = useState<FieldRoute[]>([])
  const [brigades, setBrigades] = useState<ApiBrigade[]>([])
  const [tasks, setTasks] = useState<ApiTask[]>([])
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const [routeRows, brigadeRows, taskRows] = await Promise.all([fetchRoutes(date), fetchBrigades(), fetchTasks()])
    setRoutes(routeRows); setBrigades(brigadeRows); setTasks(taskRows)
  }
  useEffect(() => { void load().catch((e) => setError(toUserMessage(e))) }, [date])
  const candidates = useMemo(() => tasks.filter((task) => ['ASSIGNED', 'ACCEPTED'].includes(task.status) && (!brigadeId || !task.brigadeId || task.brigadeId === Number(brigadeId))), [tasks, brigadeId])
  const availableBrigades = brigades.filter((brigade) =>
    brigade.isActive && (user?.role !== 'BRIGADIER' || brigade.id === user.brigadeId),
  )

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null)
    try {
      await createRoute({ workDate: date, brigadeId: Number(brigadeId), stops: selected.map((taskId) => ({ taskId })) })
      setSelected([]); await load()
    } catch (e) { setError(toUserMessage(e, 'Не удалось создать маршрут')) }
  }

  return <div className="space-y-5"><div><h1 className="text-2xl font-black text-slate-900">Маршруты бригад</h1><p className="text-sm text-slate-500">План остановок и фактическое прохождение объектов</p></div><form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-3 md:grid-cols-2"><label className="text-sm font-semibold">Дата<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-sm font-semibold">Бригада<select value={brigadeId} onChange={(e) => { setBrigadeId(e.target.value); setSelected([]) }} required className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2"><option value="">Выберите бригаду</option>{availableBrigades.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label></div><p className="mt-4 text-sm font-bold">Задачи в порядке маршрута</p><div className="mt-2 grid gap-2 lg:grid-cols-2">{candidates.map((task) => <label key={task.id} className="flex gap-3 rounded-xl bg-slate-50 p-3"><input type="checkbox" checked={selected.includes(task.id)} onChange={(e) => setSelected((old) => e.target.checked ? [...old, task.id] : old.filter((id) => id !== task.id))} /><span><b>#{task.id} {task.description}</b><small className="block text-slate-500">{task.section?.object?.name} · {task.section?.name}</small></span></label>)}</div>{candidates.length === 0 && <p className="mt-2 text-sm text-slate-500">Нет доступных задач для выбранной бригады.</p>}<button disabled={!brigadeId || selected.length === 0} className="mt-4 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-40">Создать маршрут ({selected.length})</button></form>{error && <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}<div className="grid gap-4 xl:grid-cols-2">{routes.map((route) => <article key={route.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-bold">{route.brigade.name}</h2><p className="text-sm text-slate-500">{route.workDate} · {route.stops.length} точек</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">{route.status}</span></div><ol className="mt-4 space-y-2">{route.stops.map((stop) => <li key={stop.id} className="flex gap-3 text-sm"><b className="text-emerald-700">{stop.position}.</b><span>{stop.section.object?.name} — {stop.task.description}<small className="block text-slate-400">{stop.status}</small></span></li>)}</ol></article>)}</div></div>
}
