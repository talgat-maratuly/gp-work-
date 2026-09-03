import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchMyRoute, startRoute, type FieldRoute } from '@/api/fieldApi'

export function FieldRoutePage() {
  const [route, setRoute] = useState<FieldRoute | null>(null)
  const [loading, setLoading] = useState(true)
  const load = async () => { setLoading(true); try { setRoute(await fetchMyRoute()) } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  if (loading) return <p className="py-16 text-center text-slate-500">Загрузка маршрута…</p>
  if (!route) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><h1 className="font-bold">Маршрут не назначен</h1><p className="mt-2 text-sm text-slate-500">Диспетчер ещё не составил маршрут на сегодня.</p></div>
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-black">Маршрут</h1><p className="text-sm text-slate-500">{route.brigade.name} · {route.stops.length} точек</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">{route.status === 'IN_PROGRESS' ? 'В пути' : 'Запланирован'}</span></div>
      {route.status === 'PLANNED' && <button onClick={async () => { await startRoute(route.id); await load() }} className="w-full rounded-xl bg-emerald-700 py-3 font-bold text-white">Начать маршрут</button>}
      <ol className="space-y-3">
        {route.stops.map((stop) => (
          <li key={stop.id} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 font-bold text-white">{stop.position}</span>
            <div className="min-w-0 flex-1"><p className="font-bold">{stop.section.object?.name}</p><p className="text-sm text-slate-500">{stop.section.name}</p><p className="mt-1 text-xs text-slate-400">{stop.plannedArrivalAt ? new Date(stop.plannedArrivalAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : 'Время не указано'} · {stop.status}</p></div>
            <Link to={`/field/qr?taskId=${stop.task.id}&routeStopId=${stop.id}`} className="self-center rounded-lg border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-700">QR</Link>
          </li>
        ))}
      </ol>
    </div>
  )
}
