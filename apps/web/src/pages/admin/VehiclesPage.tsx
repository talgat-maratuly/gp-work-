import { FormEvent, useEffect, useMemo, useState } from 'react'
import { fetchBrigades, type ApiBrigade } from '@/api/brigadesApi'
import { fetchRoutes, type FieldRoute } from '@/api/fieldApi'
import {
  assignVehicle,
  completeVehicleAssignment,
  createVehicle,
  fetchVehicles,
  setVehicleStatus,
  VEHICLE_STATUS_LABELS,
  VEHICLE_TYPE_LABELS,
  type Vehicle,
  type VehicleStatus,
  type VehicleType,
} from '@/api/resourcesApi'
import { toUserMessage } from '@/api/client'

const vehicleTypes = Object.keys(VEHICLE_TYPE_LABELS) as VehicleType[]
const statuses = Object.keys(VEHICLE_STATUS_LABELS) as VehicleStatus[]

export function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [brigades, setBrigades] = useState<ApiBrigade[]>([])
  const [routes, setRoutes] = useState<FieldRoute[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [assigningId, setAssigningId] = useState<number | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<VehicleType>('CAR')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [brigadeId, setBrigadeId] = useState('')
  const [routeId, setRouteId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const [vehicleRows, brigadeRows, routeRows] = await Promise.all([
      fetchVehicles(), fetchBrigades(), fetchRoutes(),
    ])
    setVehicles(vehicleRows); setBrigades(brigadeRows); setRoutes(routeRows)
  }
  useEffect(() => { void load().catch((e) => setError(toUserMessage(e))) }, [])
  const activeAssignment = (vehicle: Vehicle) => vehicle.assignments?.find((row) => ['ASSIGNED', 'ACTIVE'].includes(row.status))
  const filteredRoutes = useMemo(() => routes.filter((route) => !brigadeId || route.brigadeId === Number(brigadeId)), [routes, brigadeId])

  async function submitVehicle(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null)
    try {
      await createVehicle({ code, name, type, registrationNumber: registrationNumber || undefined })
      setCode(''); setName(''); setRegistrationNumber(''); setShowCreate(false); await load()
    } catch (e) { setError(toUserMessage(e)) } finally { setBusy(false) }
  }

  async function submitAssignment(event: FormEvent, vehicleId: number) {
    event.preventDefault(); setBusy(true); setError(null)
    try {
      await assignVehicle(vehicleId, {
        brigadeId: brigadeId ? Number(brigadeId) : undefined,
        routeId: routeId ? Number(routeId) : undefined,
        startsAt: new Date().toISOString(),
      })
      setAssigningId(null); setBrigadeId(''); setRouteId(''); await load()
    } catch (e) { setError(toUserMessage(e)) } finally { setBusy(false) }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-black">Техника и транспорт</h1><p className="text-sm text-slate-500">Машины, водовозы и оборудование с историей назначений</p></div><button onClick={() => setShowCreate((v) => !v)} className="rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white">Добавить технику</button></div>
    {showCreate && <form onSubmit={submitVehicle} className="grid gap-3 rounded-2xl border bg-white p-5 md:grid-cols-4"><input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="Код *" className="rounded-xl border px-3 py-2"/><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Название *" className="rounded-xl border px-3 py-2"/><select value={type} onChange={(e) => setType(e.target.value as VehicleType)} className="rounded-xl border px-3 py-2">{vehicleTypes.map((value) => <option key={value} value={value}>{VEHICLE_TYPE_LABELS[value]}</option>)}</select><input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} placeholder="Госномер / инв. номер" className="rounded-xl border px-3 py-2"/><button disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white md:col-span-4">Сохранить</button></form>}
    {error && <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
    <div className="grid gap-4 xl:grid-cols-2">{vehicles.map((vehicle) => { const current = activeAssignment(vehicle); return <article key={vehicle.id} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-slate-400">{vehicle.code} · {VEHICLE_TYPE_LABELS[vehicle.type]}</p><h2 className="text-lg font-black">{vehicle.name}</h2><p className="text-sm text-slate-500">{vehicle.registrationNumber || 'Без регистрационного номера'}</p></div><select value={vehicle.status} disabled={Boolean(current)} onChange={(e) => void setVehicleStatus(vehicle.id, e.target.value as VehicleStatus).then(load).catch((err) => setError(toUserMessage(err)))} className="rounded-lg border px-2 py-1 text-sm">{statuses.map((value) => <option key={value} value={value}>{VEHICLE_STATUS_LABELS[value]}</option>)}</select></div>{current ? <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm"><b>Назначено:</b> {current.brigade?.name ?? `маршрут #${current.routeId ?? '—'}`}<br/><span className="text-slate-500">с {new Date(current.startsAt).toLocaleString('ru-RU')}</span><button onClick={() => void completeVehicleAssignment(current.id, {}).then(load).catch((e) => setError(toUserMessage(e)))} className="mt-2 block font-bold text-emerald-800 underline">Завершить назначение</button></div> : assigningId === vehicle.id ? <form onSubmit={(e) => submitAssignment(e, vehicle.id)} className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2"><select value={brigadeId} onChange={(e) => { setBrigadeId(e.target.value); setRouteId('') }} className="rounded-lg border px-3 py-2"><option value="">— бригада —</option>{brigades.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select><select value={routeId} onChange={(e) => setRouteId(e.target.value)} className="rounded-lg border px-3 py-2"><option value="">— маршрут —</option>{filteredRoutes.map((row) => <option key={row.id} value={row.id}>#{row.id} · {row.workDate}</option>)}</select><button disabled={busy || (!brigadeId && !routeId)} className="rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white sm:col-span-2">Назначить</button></form> : <button onClick={() => setAssigningId(vehicle.id)} disabled={vehicle.status !== 'FREE'} className="mt-4 rounded-xl border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-800 disabled:opacity-40">Назначить бригаде / маршруту</button>}</article> })}</div>
    {!vehicles.length && <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-slate-500">Реестр техники пока пуст</div>}
  </div>
}
