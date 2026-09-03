import { useCallback, useEffect, useState } from 'react'
import { fetchDispatcher, type DispatcherData } from '@/api/operationsApi'
import { toUserMessage } from '@/api/client'
import { DispatcherMap } from '@/components/operations/DispatcherMap'

const today = new Date().toISOString().slice(0, 10)

export function DispatcherPage() {
  const [date, setDate] = useState(today)
  const [data, setData] = useState<DispatcherData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    try { setData(await fetchDispatcher(date)); setError(null) } catch (e) { setError(toUserMessage(e)) }
  }, [date])
  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 20_000)
    return () => window.clearInterval(timer)
  }, [load])
  const s = data?.summary
  return <div className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-black">Диспетчерская</h1><p className="text-sm text-slate-500">Оперативная карта · обновление каждые 20 секунд</p></div><label className="text-sm font-bold">Дата<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="ml-2 rounded-lg border px-3 py-2"/></label></div>
    {error && <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
    {s && <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">{[
      ['Вышло', s.checkedIn], ['Опоздало', s.late], ['Активные бригады', s.activeBrigades], ['Маршруты', s.routes], ['Техника', s.activeVehicles], ['Водовозы', s.waterTrucks], ['Задержки', s.overdueStops], ['Проблемы', s.problems],
    ].map(([label, value]) => <div key={label} className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>)}</div>}
    {data && <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]"><div className="overflow-hidden rounded-2xl border bg-white p-2 shadow-sm"><DispatcherMap data={data}/><div className="flex gap-4 px-3 py-2 text-xs text-slate-500"><span><b className="text-emerald-600">●</b> объекты</span><span><b className="text-blue-600">●</b> активные бригады</span><span><b className="text-amber-600">●</b> устаревшая GPS-точка</span></div></div><div className="space-y-4"><section className="rounded-2xl border bg-white p-4"><h2 className="font-black">Задержки маршрутов</h2><div className="mt-2 max-h-44 space-y-2 overflow-auto">{data.overdueStops.map((row) => <div key={row.stopId} className="rounded-xl bg-red-50 p-3 text-sm"><b>{row.object ?? `Точка #${row.stopId}`}</b><p className="text-red-700">{row.brigade} · план {new Date(row.plannedArrivalAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</p></div>)}{!data.overdueStops.length && <p className="text-sm text-emerald-700">Задержек нет</p>}</div></section><section className="rounded-2xl border bg-white p-4"><h2 className="font-black">Техника на работах</h2><div className="mt-2 max-h-44 space-y-2 overflow-auto">{data.activeAssignments.map((row) => <div key={row.vehicleId} className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm"><b>{row.vehicleName}</b><span>{row.brigade ?? `маршрут #${row.routeId}`}</span></div>)}{!data.activeAssignments.length && <p className="text-sm text-slate-500">Активных назначений нет</p>}</div></section></div></div>}
    {data && <div className="grid gap-4 xl:grid-cols-2"><section className="rounded-2xl border bg-white p-5"><h2 className="font-black">Проблемные работы</h2><div className="mt-3 divide-y">{data.problems.map((row) => <div key={row.executionId} className="py-3 text-sm"><div className="flex justify-between"><b>#{row.taskId} {row.task}</b><span className={row.status === 'REJECTED' ? 'text-red-700' : 'text-amber-700'}>{row.status}</span></div><p className="text-slate-500">{row.object} · {row.worker}</p></div>)}</div></section><section className="rounded-2xl border bg-white p-5"><h2 className="font-black">Лента событий</h2><div className="mt-3 max-h-80 divide-y overflow-auto">{data.events.map((row) => <div key={row.id} className="py-3 text-sm"><div className="flex justify-between"><b>{row.type}</b><time className="text-xs text-slate-400">{new Date(row.occurredAt).toLocaleTimeString('ru-RU')}</time></div><p className="text-slate-500">{row.object ?? '—'} · {row.actor ?? 'Система'}</p></div>)}</div></section></div>}
  </div>
}
